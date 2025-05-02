/**
 * Generate an order ID based on the order number
 * @param {number} orderNumber - The numeric order number
 * @returns {string} The formatted order ID
 */
const generateOrderId = (orderNumber) => {
  const year = new Date().getFullYear().toString().slice(-2);
  const hexNumber = orderNumber.toString(16).toUpperCase().padStart(5, '0');
  return `BS${year}${hexNumber}`;
};

module.exports = {
  generateOrderId
}; 