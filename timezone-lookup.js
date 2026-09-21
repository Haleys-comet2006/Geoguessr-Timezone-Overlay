(function (global) {
  let finderPromise = null;

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const WEEKDAYS = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  async function getFinder() {
    if (!finderPromise) {
      finderPromise = (async () => {
        const moduleUrl = chrome.runtime.getURL(
          "vendor/tzf-wasm/tzf_wasm.js"
        );

        const { default: init, WasmFinder } =
          await import(moduleUrl);

        await init();

        const finder = new WasmFinder();

        console.log(
          "[GGTZ] tzf-wasm initialized, data version:",
          finder.data_version()
        );

        return finder;
      })();
    }

    return finderPromise;
  }

  function getZoneEntry(zoneName, timestamp) {
    let zone = tzdata.zones[zoneName];

    if (!zone) {
      return null;
    }

    while (typeof zone === "string") {
      zone = tzdata.zones[zone];

      if (!zone) {
        return null;
      }
    }

    for (const entry of zone) {
      const until = entry[3];

      if (
        until === null ||
        Number(until) > timestamp
      ) {
        return entry;
      }
    }

    return null;
  }

  function getDaysInMonth(year, month) {
    return new Date(
      Date.UTC(year, month + 1, 0)
    ).getUTCDate();
  }

  function getWeekday(year, month, day) {
    return new Date(
      Date.UTC(year, month, day)
    ).getUTCDay();
  }

  function getLastWeekdayOfMonth(
    year,
    month,
    weekday
  ) {
    const lastDay =
      getDaysInMonth(year, month);

    const lastWeekday =
      getWeekday(
        year,
        month,
        lastDay
      );

    return (
      lastDay -
      ((lastWeekday - weekday + 7) % 7)
    );
  }

  function getFirstWeekdayOnOrAfter(
    year,
    month,
    weekday,
    day
  ) {
    const currentWeekday =
      getWeekday(
        year,
        month,
        day
      );

    return (
      day +
      ((weekday - currentWeekday + 7) % 7)
    );
  }

  function getLastWeekdayOnOrBefore(
    year,
    month,
    weekday,
    day
  ) {
    const currentWeekday =
      getWeekday(
        year,
        month,
        day
      );

    return (
      day -
      ((currentWeekday - weekday + 7) % 7)
    );
  }

  function getRuleDate(
    rule,
    year,
    month
  ) {
    if (rule == null) {
      return null;
    }

    const value = String(rule);

    // Plain calendar day:
    // "1", "15", "31", etc.
    if (/^\d+$/.test(value)) {
      const day = Number(value);

      if (
        day < 1 ||
        day > getDaysInMonth(year, month)
      ) {
        return null;
      }

      return day;
    }

    // lastSun, lastMon, lastThu, etc.
    const lastMatch =
      value.match(
        /^last(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/
      );

    if (lastMatch) {
      const weekday =
        WEEKDAYS[lastMatch[1]];

      return getLastWeekdayOfMonth(
        year,
        month,
        weekday
      );
    }

    // Sun>=8, Fri>=23, etc.
    const onOrAfterMatch =
      value.match(
        /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)>=(\d+)$/
      );

    if (onOrAfterMatch) {
      const weekday =
        WEEKDAYS[onOrAfterMatch[1]];

      const day =
        Number(onOrAfterMatch[2]);

      if (
        day < 1 ||
        day > getDaysInMonth(year, month)
      ) {
        return null;
      }

      const result =
        getFirstWeekdayOnOrAfter(
          year,
          month,
          weekday,
          day
        );

      if (
        result > getDaysInMonth(year, month)
      ) {
        return null;
      }

      return result;
    }

    // Sun<=25, Fri<=30, etc.
    const onOrBeforeMatch =
      value.match(
        /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)<=(\d+)$/
      );

    if (onOrBeforeMatch) {
      const weekday =
        WEEKDAYS[onOrBeforeMatch[1]];

      const day =
        Number(onOrBeforeMatch[2]);

      if (
        day < 1 ||
        day > getDaysInMonth(year, month)
      ) {
        return null;
      }

      return getLastWeekdayOnOrBefore(
        year,
        month,
        weekday,
        day
      );
    }

    return null;
  }

  function parseRuleTime(value) {
    if (value == null) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        suffix: "w",
      };
    }

    // tzdata may represent AT as:
    // ["2", "0", "0", null]
    if (Array.isArray(value)) {
      const suffix =
        value[3] === "u" ||
        value[3] === "s" ||
        value[3] === "w"
          ? value[3]
          : "w";

      return {
        hours: Number(value[0]) || 0,
        minutes: Number(value[1]) || 0,
        seconds: Number(value[2]) || 0,
        suffix,
      };
    }

    const string = String(value);

    const suffixMatch =
      string.match(/([suw])$/);

    const suffix =
      suffixMatch?.[1] ?? "w";

    const timeString =
      suffixMatch
        ? string.slice(0, -1)
        : string;

    const match =
      timeString.match(
        /^(-?\d+)(?::(\d+))?(?::(\d+))?$/
      );

    if (!match) {
      return {
        hours: 0,
        minutes: 0,
        seconds: 0,
        suffix,
      };
    }

    return {
      hours: Number(match[1]) || 0,
      minutes: Number(match[2]) || 0,
      seconds: Number(match[3]) || 0,
      suffix,
    };
  }

  function parseSave(value) {
    if (value == null) {
      return 0;
    }

    if (typeof value === "number") {
      return value;
    }

    const string = String(value).trim();

    if (string === "") {
      return 0;
    }

    // Most tzdata package data stores SAVE
    // directly as minutes, e.g. "30" or "60".
    if (/^-?\d+$/.test(string)) {
      return Number(string);
    }

    // Also support HH:MM[:SS] just in case.
    const match =
      string.match(
        /^(-?\d+):(\d+)(?::(\d+))?$/
      );

    if (match) {
      const hours =
        Number(match[1]);

      const minutes =
        Number(match[2]);

      const seconds =
        Number(match[3] ?? 0);

      const sign =
        hours < 0 ? -1 : 1;

      return (
        hours * 60 +
        sign * minutes +
        sign * (seconds / 60)
      );
    }

    return 0;
  }

  function ruleAppliesToYear(
    rule,
    year
  ) {
    const from =
      Number(rule[0]);

    const to =
      String(rule[1]);

    if (Number.isNaN(from)) {
      return false;
    }

    if (year < from) {
      return false;
    }

    if (to === "max") {
      return true;
    }

    if (to === "only") {
      return year === from;
    }

    const toYear =
      Number(to);

    if (Number.isNaN(toYear)) {
      return false;
    }

    return year <= toYear;
  }

  function buildRuleCalendarDate(
    rule,
    year
  ) {
    const monthName =
      rule[3];

    const dayRule =
      rule[4];

    const month =
      MONTHS.indexOf(monthName);

    if (month < 0) {
      return null;
    }

    const day =
      getRuleDate(
        dayRule,
        year,
        month
      );

    if (day === null) {
      return null;
    }

    const time =
      parseRuleTime(rule[5]);

    return {
      year,
      month,
      day,
      hours: time.hours,
      minutes: time.minutes,
      seconds: time.seconds,
      suffix: time.suffix,
      save: parseSave(rule[6]),
    };
  }

  function calendarDateToUtc(
    calendar,
    standardOffset,
    previousSave
  ) {
    let timestamp = Date.UTC(
      calendar.year,
      calendar.month,
      calendar.day,
      calendar.hours,
      calendar.minutes,
      calendar.seconds
    );

    switch (calendar.suffix) {
      case "u":
        // Already UTC.
        break;

      case "s":
        // Standard time.
        timestamp -=
          standardOffset * 60_000;
        break;

      case "w":
      default:
        // Wall clock time.
        timestamp -=
          (
            standardOffset +
            previousSave
          ) * 60_000;
        break;
    }

    return timestamp;
  }

  function getTransitionsForYear(
    ruleName,
    year,
    standardOffset,
    initialSave = 0
  ) {
    const rules =
      tzdata.rules[ruleName];

    if (!rules) {
      return [];
    }

    const candidates = [];

    for (const rule of rules) {
      if (
        !ruleAppliesToYear(
          rule,
          year
        )
      ) {
        continue;
      }

      const calendar =
        buildRuleCalendarDate(
          rule,
          year
        );

      if (!calendar) {
        continue;
      }

      candidates.push({
        rule,
        calendar,
      });
    }

    candidates.sort((a, b) => {
      const aTime =
        Date.UTC(
          a.calendar.year,
          a.calendar.month,
          a.calendar.day,
          a.calendar.hours,
          a.calendar.minutes,
          a.calendar.seconds
        );

      const bTime =
        Date.UTC(
          b.calendar.year,
          b.calendar.month,
          b.calendar.day,
          b.calendar.hours,
          b.calendar.minutes,
          b.calendar.seconds
        );

      return aTime - bTime;
    });

    let previousSave =
      initialSave;

    for (const candidate of candidates) {
      candidate.utc =
        calendarDateToUtc(
          candidate.calendar,
          standardOffset,
          previousSave
        );

      previousSave =
        candidate.calendar.save;
    }

    return candidates
      .map((candidate) => ({
        timestamp:
          candidate.utc,
        save:
          candidate.calendar.save,
      }))
      .sort(
        (a, b) =>
          a.timestamp -
          b.timestamp
      );
  }

  function getCurrentSave(
    ruleName,
    timestamp,
    standardOffset
  ) {
    if (
      !ruleName ||
      ruleName === "-"
    ) {
      return 0;
    }

    if (
      !tzdata.rules[ruleName]
    ) {
      return 0;
    }

    const date =
      new Date(timestamp);

    const year =
      date.getUTCFullYear();

    // Establish the SAVE state entering
    // the requested year.
    const previousYearTransitions =
      getTransitionsForYear(
        ruleName,
        year - 1,
        standardOffset,
        0
      );

    let save = 0;

    if (
      previousYearTransitions.length > 0
    ) {
      save =
        previousYearTransitions[
          previousYearTransitions.length - 1
        ].save;
    }

    // Apply this year's transitions
    // up to the requested timestamp.
    const currentYearTransitions =
      getTransitionsForYear(
        ruleName,
        year,
        standardOffset,
        save
      );

    for (
      const transition
      of currentYearTransitions
    ) {
      if (
        transition.timestamp >
        timestamp
      ) {
        break;
      }

      save =
        transition.save;
    }

    return save;
  }

  function getCurrentOffsetMinutes(
    zoneName,
    timestamp = Date.now()
  ) {
    const entry =
      getZoneEntry(
        zoneName,
        timestamp
      );

    if (!entry) {
      throw new Error(
        `Unknown timezone: ${zoneName}`
      );
    }

    // tzdata stores STDOFF with the
    // opposite sign from the actual offset.
    const standardOffset =
      -Number(entry[0]);

    const ruleName =
      entry[1];

    const save =
      getCurrentSave(
        ruleName,
        timestamp,
        standardOffset
      );

    return (
      standardOffset + save
    );
  }
  async function lookupTimezone(
    lat,
    lng
  ) {
    try {
      const finder =
        await getFinder();

      const zoneName =
        finder.get_tz_name(
          lng,
          lat
        );

      if (!zoneName) {
        console.warn(
          "[GGTZ] tzf-wasm found no timezone:",
          lat,
          lng
        );

        return {
          error:
            "timezone_not_found",
        };
      }

      const offsetMinutes =
        getCurrentOffsetMinutes(
          zoneName
        );

      return {
        zoneName,
        gmtOffsetHours:
          offsetMinutes / 60,
        gmtOffsetMinutes:
          offsetMinutes,
        source: "tzf",
      };

    } catch (err) {
      console.error(
        "[GGTZ] timezone lookup failed:",
        err
      );

      return {
        error:
          "timezone_lookup_failed",
      };
    }
  }

  global.TZLookup = {
    lookupTimezone,
    getCurrentOffsetMinutes,
  };

})(window);