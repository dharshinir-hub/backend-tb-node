import React, { useEffect, useState } from "react";
import dayjs from "dayjs";

const FiscalWeek = ({ fiscalYearStartMonth = 1, onWeekChange }) => {
  const getWeek = () => {
    const now = dayjs();
    let year = now.year();
    let fiscalStart = dayjs(`${year}-${String(fiscalYearStartMonth).padStart(2, "0")}-01`);
    if (now.isBefore(fiscalStart)) {
      fiscalStart = fiscalStart.subtract(1, "year");
    }
    const fiscalStartDay = fiscalStart.day();
    const alignedFiscalStart = fiscalStart.subtract((fiscalStartDay + 6) % 7, "day"); 
    const diffDays = now.diff(alignedFiscalStart, "day");
    const weekNumber = Math.floor(diffDays / 7) + 1;
    return weekNumber;
  };

  const [week, setWeek] = useState(getWeek());

  useEffect(() => {
    if (onWeekChange) onWeekChange(week);
    const interval = setInterval(() => {
      const currentWeek = getWeek();
      if (currentWeek !== week) {
        setWeek(currentWeek);
        if (onWeekChange) onWeekChange(currentWeek);
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [week, onWeekChange]);

  return <div style={{  fontSize: "14px",
    fontWeight: 600}}>Fiscal Week: {week}</div>;
};

export default FiscalWeek;
