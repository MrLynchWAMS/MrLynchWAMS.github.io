/**
 * IterātED Simulation Bridge Template
 * ====================================
 * Copy the functions below into your external simulation page.
 * Your simulation runs in an iframe hosted by IterātED.
 * 
 * IMPORTANT: Do NOT include any Firebase SDKs or auth logic.
 * The parent wrapper handles all database operations.
 *
 * ## API Contract
 * 
 * When your simulation is complete, call submitSimulation() to notify
 * the parent wrapper. You can optionally include contextual data
 * (simData) that will be stored and visible to the teacher.
 *
 * ## simData Guidelines
 * - Can be any JSON-serializable object
 * - Arrays of objects will be rendered as tables on the teacher dashboard
 * - Flat key-value pairs will be rendered as a list
 * - Keep it under ~50KB for Firestore document size limits
 * - Examples:
 *   - Ice core sim: { dataTable: [{depth, co2, temp}, ...], summary: "..." }
 *   - Carbon footprint: { totalFootprint: 12.4, breakdown: {transport: 5.2, ...} }
 *   - Lab sim: { measurements: [...], hypothesis: "...", conclusion: "..." }
 */

function submitSimulation(simData = null) {
  const message = {
    action: "SIM_COMPLETE"
  };

  if (simData !== null && simData !== undefined) {
    message.simData = simData;
  }

  // Replace with your actual parent origin in production
  const parentOrigin = "https://custom.scienceclass.rocks";

  window.parent.postMessage(message, parentOrigin);
}

// --- Example Usage ---

// Simple simulation with no data:
// submitSimulation();

// Simulation with a data table (e.g., ice core analysis):
// submitSimulation({
//   dataTable: [
//     { depth: 100, co2_ppm: 280, temp_anomaly: -0.2 },
//     { depth: 200, co2_ppm: 310, temp_anomaly: 0.1 },
//     { depth: 300, co2_ppm: 350, temp_anomaly: 0.8 }
//   ],
//   summary: "3 ice cores analyzed across 300m depth range"
// });

// Simulation with flat results (e.g., carbon footprint):
// submitSimulation({
//   totalFootprint: 12.4,
//   unit: "metric tons CO2/year",
//   topCategory: "Transportation",
//   breakdown: {
//     transportation: 5.2,
//     housing: 3.1,
//     food: 2.8,
//     goods: 1.3
//   }
// });
