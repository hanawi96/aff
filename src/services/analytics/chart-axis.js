/** Nhãn tháng theo lịch (T3 = tháng 3), không đánh lại từ T1. */
export function monthLabels(seriesStart, seriesEnd, getVNDate) {
    const start = getVNDate(seriesStart);
    const end = getVNDate(Math.max(seriesEnd, seriesStart));
    const labels = [];
    let year = start.year;
    let month = start.month;
    const crossYear = start.year !== end.year;
    while (year < end.year || (year === end.year && month <= end.month)) {
        labels.push(crossYear ? `${month}/${String(year).slice(-2)}` : `T${month}`);
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
        if (labels.length > 48) break;
    }
    return labels.length ? labels : [`T${start.month}`];
}

/** Vị trí tháng của một mốc so với tháng bắt đầu của chuỗi. */
export function monthBucketIndex(timestamp, seriesStart, getVNDate) {
    const point = getVNDate(timestamp);
    const start = getVNDate(seriesStart);
    return (point.year - start.year) * 12 + (point.month - start.month);
}
