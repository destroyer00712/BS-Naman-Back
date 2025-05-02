const fetch = require('node-fetch');
const whatsappConfig = require('../config/whatsapp');

/**
 * Send worker assignment notification
 * @param {string} workerPhone - Worker's phone number
 * @param {object} order - Order details
 */
const sendWorkerAssignmentMessage = async (workerPhone, order) => {
  try {
    await fetch(`${whatsappConfig.WHATSAPP_API_ROOT}${whatsappConfig.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappConfig.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: workerPhone,
        type: "template",
        template: {
          name: "worker_assignment",
          language: {
            code: "en"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: order.order_id
                },
                {
                  type: "text",
                  text: order.jewellery_details.name || "Not specified"
                },
                {
                  type: "text",
                  text: order.jewellery_details.weight || "Not specified"
                },
                {
                  type: "text",
                  text: order.jewellery_details.melting || "Not specified"
                },
                {
                  type: "text",
                  text: order.jewellery_details.special || "No special instructions"
                }
              ]
            }
          ]
        }
      })
    });
  } catch (error) {
    console.error('Error sending worker assignment message:', error);
  }
};

/**
 * Send worker removal notification
 * @param {string} workerPhone - Worker's phone number
 * @param {object} order - Order details
 */
const sendWorkerRemovalMessage = async (workerPhone, order) => {
  try {
    await fetch(`${whatsappConfig.WHATSAPP_API_ROOT}${whatsappConfig.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappConfig.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: workerPhone,
        type: "template",
        template: {
          name: "worker_changed",
          language: {
            code: "en"
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: order.order_id
                }
              ]
            }
          ]
        }
      })
    });
  } catch (error) {
    console.error('Error sending worker removal message:', error);
  }
};

/**
 * Get all phone numbers for a worker
 * @param {object} connection - Database connection
 * @param {string} primaryPhone - Worker's primary phone number
 * @returns {Array} Array of phone numbers
 */
const getWorkerPhoneNumbers = async (connection, primaryPhone) => {
  try {
    // Get the worker's ID from the primary phone
    const [workerIdResult] = await connection.execute(
      'SELECT worker_id FROM worker_phones WHERE phone_number = ?',
      [primaryPhone]
    );
    
    if (workerIdResult.length === 0) {
      return [primaryPhone]; // Return just the primary phone if not found
    }
    
    // Get all phone numbers for this worker
    const workerId = workerIdResult[0].worker_id;
    const [phoneResults] = await connection.execute(
      'SELECT phone_number FROM worker_phones WHERE worker_id = ?',
      [workerId]
    );
    
    return phoneResults.map(row => row.phone_number);
  } catch (error) {
    console.error('Error getting worker phone numbers:', error);
    return [primaryPhone]; // Return just the primary phone number in case of error
  }
};

module.exports = {
  sendWorkerAssignmentMessage,
  sendWorkerRemovalMessage,
  getWorkerPhoneNumbers
}; 