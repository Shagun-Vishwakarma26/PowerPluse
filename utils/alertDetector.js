const Reading = require('../models/Reading');
const Alert = require('../models/Alert');
const Setting = require('../models/Setting');

/**
 * Evaluates a single reading against settings thresholds and creates an Alert if necessary.
 * @param {Object} reading - The created or updated reading object
 */
const checkReadingForAlerts = async (reading) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = {
        highConsumptionThreshold: 150,
        criticalConsumptionThreshold: 200,
        enableAlerts: true
      };
    }

    if (!settings.enableAlerts) return null;

    // Calculate historical average for this location or meter (excluding current reading ID if updating)
    const historicalReadings = await Reading.find({
      location: reading.location,
      _id: { $ne: reading._id }
    }).limit(100);

    if (historicalReadings.length === 0) return null;

    const totalConsumption = historicalReadings.reduce((sum, r) => sum + r.consumption, 0);
    const avgConsumption = totalConsumption / historicalReadings.length;

    if (avgConsumption <= 0) return null;

    const percentage = (reading.consumption / avgConsumption) * 100;

    let alertData = null;

    if (percentage >= settings.criticalConsumptionThreshold) {
      alertData = {
        type: 'Critical Consumption',
        severity: 'Critical',
        location: reading.location,
        meterId: reading.meterId,
        message: `Critical consumption spike detected! ${reading.consumption} kWh is ${percentage.toFixed(1)}% of average (${avgConsumption.toFixed(1)} kWh).`,
        consumption: reading.consumption,
        threshold: avgConsumption * (settings.criticalConsumptionThreshold / 100),
        status: 'New'
      };
    } else if (percentage >= settings.highConsumptionThreshold) {
      alertData = {
        type: 'High Consumption',
        severity: 'High',
        location: reading.location,
        meterId: reading.meterId,
        message: `High consumption detected. ${reading.consumption} kWh exceeds normal threshold of ${settings.highConsumptionThreshold}%.`,
        consumption: reading.consumption,
        threshold: avgConsumption * (settings.highConsumptionThreshold / 100),
        status: 'New'
      };
    }

    if (alertData) {
      const newAlert = await Alert.create(alertData);
      console.log(`[ALERT CREATED] ${newAlert.type} for ${newAlert.location} (${newAlert.meterId})`);
      return newAlert;
    }

    return null;
  } catch (error) {
    console.error('Error in alert detector:', error.message);
    return null;
  }
};

module.exports = { checkReadingForAlerts };
