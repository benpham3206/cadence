export function checkRetirement(retirementCounters, weakList, overallMean) {
  const retired = [];
  for (const w of weakList) {
    const key = w.digraph;
    if (w.mean < overallMean) {
      retirementCounters[key] = (retirementCounters[key] || 0) + 1;
      if (retirementCounters[key] >= 3) {
        retired.push(key);
        delete retirementCounters[key];
      }
    } else {
      retirementCounters[key] = 0;
    }
  }
  return retired;
}
