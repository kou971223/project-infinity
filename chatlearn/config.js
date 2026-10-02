/** Fixed conversion contract, checked against the pinned ONNX bytes on 2026-10-02. */
export const PROTOCOL='PINF-CHAT-NORM-2';
export const MODEL='onnx-community/Qwen2.5-0.5B-Instruct';
export const REVISION='cc5cc01a65cc3ff17bdb73a7de33d879f62599b0';
export const MODEL_URL=`https://huggingface.co/${MODEL}/resolve/${REVISION}/onnx/model_quantized.onnx`;
export const ASSET=Object.freeze({bytes:512096557,sha256:'41834041ab1b29eff9fc592f1a29a1844133aea35832ea9fa91682be13016100',chunkSize:1048576,offset:17876744,length:3584,normHash:'93a01a6db3419e85320a244bbf8ae81c43033b1d10c342bea3797ff2ce348390',parameter:'model.norm.weight'});
export const LIMITS=Object.freeze({manifestBytes:100000,values:896,targetCases:12,anchorCases:12,behaviorCases:8,minGain:0.01,maxAnchorIncrease:0.05,maxMeanAnchorIncrease:0.01,minBaselineBehaviorPasses:4});
export const SYSTEM='You are Project Infinity, a small local assistant. Reply in Japanese. Be brief and honest about uncertainty. This chat runs locally. You cannot execute code, deploy apps or browse the web in this conversation. A separately tested partial model update may be loaded; do not claim general intelligence or recursive self-improvement has been demonstrated.';
