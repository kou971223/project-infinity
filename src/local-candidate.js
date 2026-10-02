/** Model output is data. The trusted interpreter, not the model, owns execution. */
export function parseCandidate(text) {
  if (typeof text !== 'string' || text.length > 20000) throw new Error('CANDIDATE_SIZE');
  let clean = text.trim();
  if (clean.startsWith('```')) clean = clean.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const value = JSON.parse(clean);
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(k => !['hypothesis','program'].includes(k)) ||
      typeof value.hypothesis !== 'string' || value.hypothesis.length < 10 ||
      value.hypothesis.length > 1200 || !Array.isArray(value.program)) throw new Error('CANDIDATE_SCHEMA');
  return {hypothesis:value.hypothesis,program:value.program};
}
