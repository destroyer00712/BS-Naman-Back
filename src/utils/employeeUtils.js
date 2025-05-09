/**
 * Generate a unique employee ID
 * Format: EMP + 6 digits (e.g., EMP000001)
 */
const generateEmployeeId = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const id = timestamp.slice(-3) + random;
  return `EMP${id}`;
};

module.exports = {
  generateEmployeeId
}; 