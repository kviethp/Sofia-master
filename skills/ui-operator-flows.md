---
{
  "id": "ui-operator-flows",
  "version": "1.0.0",
  "owner": "UI and Operator Experience",
  "description": "Build Web and Admin flows that reflect real API capability.",
  "intent": "Keep UI behavior explicit, minimal, and faithful to the control plane.",
  "inputs": ["API contracts", "runtime status surfaces", "operator actions"],
  "constraints": ["Do not simulate missing backend behavior.", "Treat the API as the system of record.", "Record backend gaps instead of hiding them."],
  "requiredTools": ["docs", "node", "shell"],
  "expectedOutputs": ["UI route evidence", "backend dependency notes", "unsupported flow notes"],
  "qualityGates": ["Every operator action maps to a real API call.", "Unsupported flows are explicit.", "Control-token handling is safe and documented."],
  "trustLevel": "internal-trusted"
}
---
# UI and Operator Flows

1. Start from the API contract.
2. Prefer explicit operator workflows over decorative UI.
3. Record missing backend support instead of inventing client-side behavior.
