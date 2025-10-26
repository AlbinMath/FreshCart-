import mongoose from 'mongoose';

const availabilitySlotSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    start: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/
    },
    end: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/
    },
    enabled: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const deliverySettingsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    deliveryArea: {
      name: {
        type: String,
        required: true,
        trim: true
      },
      coordinates: {
        lat: {
          type: Number,
          required: true,
          min: -90,
          max: 90
        },
        lng: {
          type: Number,
          required: true,
          min: -180,
          max: 180
        }
      }
    },
    isAvailable: {
      type: Boolean,
      default: false
    },
    availability: {
      type: [availabilitySlotSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const DeliverySettings = mongoose.model('DeliverySettings', deliverySettingsSchema);
export default DeliverySettings;