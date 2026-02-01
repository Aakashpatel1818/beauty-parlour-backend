const Service = require('../models/Service');
const Joi = require('joi');

const serviceSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string(),
  price: Joi.number().required(),
  duration: Joi.number().required(),
  category: Joi.string().required(),
  image: Joi.string()
});

exports.createService = async (req, res) => {
  const { error } = serviceSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.details[0].message });

  try {
    const service = new Service(req.body);
    await service.save();
    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getServices = async (req, res) => {
  try {
    const services = await Service.find();
    res.json(services);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Add update/delete similarly