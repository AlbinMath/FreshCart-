/**
 * Calculates the delivery fee based on the subtotal using slab logic:
 * - ₹1–₹200: 40%
 * - ₹201–₹400: 20%
 * - ₹401–₹499: 10%
 * - ₹500+: 0%
 *
 * @param {number} subtotal - The subtotal amount in rupees
 * @returns {number} - The delivery fee in rupees
 */
function calculateDeliveryFee(subtotal) {
  if (subtotal <= 200) {
    return subtotal * 0.4;
  } else if (subtotal <= 400) {
    return subtotal * 0.2;
  } else if (subtotal <= 499) {
    return subtotal * 0.1;
  } else {
    return 0;
  }
}

/**
 * Calculates the total amount including delivery fee.
 *
 * @param {number} subtotal - The subtotal amount in rupees
 * @returns {Object} - Object containing subtotal, deliveryFee, and totalAmount
 */
function calculateTotal(subtotal) {
  const deliveryFee = calculateDeliveryFee(subtotal);
  const totalAmount = subtotal + deliveryFee;
  return {
    subtotal: Math.round(subtotal * 100) / 100, // Round to 2 decimal places
    deliveryFee: Math.round(deliveryFee * 100) / 100,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

export {
  calculateDeliveryFee,
  calculateTotal,
};