/* global use */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use("hydrotherapy");
const machineId = new ObjectId("6a717ccc30b3e06800cdff91");
//db.patients.find({ "machine_id": { $ne: machineId} }).sort({ "timestamp": -1 }).pretty();
db.sessions.updateMany(
  { "machine_id": { $ne: machineId} },
  { $set: { "machine_id": machineId } }
);
