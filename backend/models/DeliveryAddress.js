import mongoose from 'mongoose';

const coordinateSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

const singleAddressSchema = new mongoose.Schema(
  {
    addressLine: {
      type: String,
      required: true,
      trim: true,
      minlength: 5
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    state: {
      type: String,
      required: true,
      trim: true
    },
    postalCode: {
      type: String,
      required: true,
      trim: true
    },
    coordinates: {
      type: coordinateSchema,
      required: true
    }
  },
  { _id: false }
);

const deliveryAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    permanentAddress: {
      type: singleAddressSchema,
      required: true
    },
    livingAddress: {
      type: singleAddressSchema,
      required: true
    }
  },
  {
    timestamps: true
  }
);

const DeliveryAddress = mongoose.model('DeliveryAddress', deliveryAddressSchema);
export default DeliveryAddress;