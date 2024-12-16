const express = require("express");
const router = express.Router();
const taskController = require("../controllers/TaskController");
const jwtAuthenticator = require('../utils/JWTAuthenticator');
const {
  validateGetAllTasks,
} = require("../middleware/validator/TaskValidator");

router.get(
    "/", jwtAuthenticator,
    validateGetAllTasks, 
    taskController.getAllTasks
);

router.post("/createTask", jwtAuthenticator, taskController.createTask);

router.patch("/updateTask", jwtAuthenticator, taskController.updateTask);

router.delete("/deleteTask/:taskId", jwtAuthenticator, taskController.deleteTask);

module.exports = router;
