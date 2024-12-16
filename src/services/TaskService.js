const Task = require("../models/Task");

class TaskService {
  async getAllTasks(taskQuery) {
    const tasks = await Task.find(taskQuery);
    return tasks;
  }

  async createTask(taskData) {
    try {
      
      const task = new Task({
        ...taskData
      });

      // Save the event
      await task.save();
      console.log("Task created:", task);
      return task;
    } catch (error) {
      console.log("Error creating task:", error.message);
      throw error;
    }
  }

  async updateTask(updatedDetails) {
    try {
      const task = await Task.findOne({ id: updatedDetails.id });

      if (!task) {
        throw new createHttpError(404, "Task not found");
      }
      task.set(updatedDetails);
      await task.save();

      console.log("Task updated:", task);
      return task;
    } catch (error) {
      throw error;
    }
  }

  async deleteTask(id, taskBody) {
    console.log("ID : ", id );
    const task = await Task.findOneAndDelete({ id : id });
    return task;
  }
}

module.exports = new TaskService();
