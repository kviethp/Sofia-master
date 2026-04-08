import {createTaskPrompt, formatRecentTurnsForPrompt} from '../src/run-executor.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const turns = [
  {role: 'system', text: 'System resumed active task.'},
  {role: 'user', text: 'Please continue the current task from where it stopped.'},
  {role: 'assistant', text: 'I will continue from the latest milestone and preserve constraints.'},
  {role: 'user', text: 'Prioritize the safest next action and keep the summary concise.'}
];

const formattedTurns = formatRecentTurnsForPrompt(turns);
assert(formattedTurns.includes('- user: Please continue the current task from where it stopped.'), 'formatted recent turns missing user turn');
assert(formattedTurns.includes('- assistant: I will continue from the latest milestone and preserve constraints.'), 'formatted recent turns missing assistant turn');

const prompt = createTaskPrompt(
  {title: 'Lock in memory continuity defaults', risk: 'medium'},
  {workerRole: 'builder'},
  {
    resumeBlock: '# Sofia Resume Block\n\n## Active Timeline\n- Current objective: Lock in memory continuity defaults\n- Next safe action: Preserve continuity context by default',
    recentTurns: turns
  }
);

assert(prompt.includes('### Active Task Memory'), 'prompt missing Active Task Memory section');
assert(prompt.includes('### Recent Turns'), 'prompt missing Recent Turns section');
assert(prompt.includes('Use the active task memory and recent turns only as compact carry-forward context.'), 'prompt missing continuity guidance');
assert(prompt.includes('Lock in memory continuity defaults'), 'prompt missing task title');
assert(prompt.includes('Please continue the current task from where it stopped.'), 'prompt missing recent user turn');

console.log('[sofia] memory continuity defaults validation passed');
console.log(JSON.stringify({
  promptPreview: prompt.split('\n').slice(0, 20),
  recentTurnCount: turns.length
}, null, 2));
