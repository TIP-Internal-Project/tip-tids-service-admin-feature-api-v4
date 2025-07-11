const Task = require("../models/Task");
const logger = require("../utils/Logger");
const TeamMemberTask = require("../models/TeamMemberTask");
const TeamMember = require("../models/TeamMember");
const { convertToTimezone } = require("../utils/DateUtils");
const createHttpError = require("http-errors");

// Helper function to convert dates to specified timezone
const convertDatesToTimezone = (task, timezone) => {
  if (!task) return task;

  const converted = { ...task._doc || task };
  
  // Convert date fields
  const dateFields = ['startedDate', 'completionDate', 'createdAt', 'updatedAt', 'assignedDate', 'dueDate'];
  dateFields.forEach(field => {
    if (converted[field]) {
      converted[field] = convertToTimezone(converted[field], timezone);
    }
  });
  
  return converted;
};

class TaskService {

  /**
   * Fetch tasks based on dynamic filters or return all tasks if no filters are provided.
   * 
   * @param {Object} filters - Object containing filter criteria
   * @returns {Promise<Array<Object>>} - Array of task details
   */
  async getTasksByFilters(filters = {}, timezone = 'UTC') {
    const query = {};

    if (filters.taskIds && filters.taskIds.length) {
      query.id = { $in: filters.taskIds }; // Matches multiple task IDs
    }

    if (filters.isArchived) {
      query.isArchived = filters.isArchived;
    }

    if (filters.importance) {
      query.importance = filters.importance;
    }

    try {
      const tasks = await Task.find(query);
      return tasks.map(task => convertDatesToTimezone(task, timezone));

    }catch (error) {
      logger.error(`Error fetching task: ${error.message}`);
      throw error;
    }
  }

  /**
   * This is for auto assigning a task when created to all team members
   * 
   * @param {number} id - Object containing task details
   * @returns {void} - will perform bulk insert
   */  
  async bulkAssignTeamMemberTask(id) {
    const teamMembers = await TeamMember.find({status: "active"});

    let teamMemberTasks = [];

    teamMembers.forEach((obj) => {
      teamMemberTasks.push({
        taskId: id,
        teamMemberWorkdayId: obj.workdayId,
        teamMemberEmail: obj.email
      });
    });

    await TeamMemberTask.insertMany(teamMemberTasks);
  }

  /**
   * Create a new task with the provided task data.
   * 
   * @param {Object} taskData - Object containing task details
   * @returns {Promise<Object>} - Created task object
   */
  async createTask(taskData, timezone = 'UTC') {
    try {
      const task = new Task({ ...taskData });
      await task.save();
      logger.info(`Task created: ${task._id}`);
      return convertDatesToTimezone(task, timezone);
    } catch (error) {
      logger.error(`Error creating task: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update an existing task based on the updated details provided.
   * 
   * @param {Object} updatedDetails - Object containing task update details
   * @returns {Promise<Object>} - Updated task object
   */
  async updateTask(updatedDetails, timezone = 'UTC') {
    try {
      const task = await Task.findOne({ id: updatedDetails.id });

      if (!task) {
        logger.error("409 Task not found");
        throw new createHttpError(404, "Task not found");
      }
      task.set(updatedDetails);
      await task.save();

      logger.info(`Task updated: ${task._id}`);
      return convertDatesToTimezone(task, timezone);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete a task based on its ID, applying the provided update body.
   * 
   * @param {String} id - ID of the task to delete
   * @param {Object} taskBody - Update details to apply upon deletion
   * @returns {Promise<Object>} - Deleted task object
   */
  async deleteTask(id, taskBody) {
    const task = await Task.findOneAndUpdate({ id }, taskBody, {
      new: true,
      useFindAndModify: false,
    });
    return task;
  }

  /**
   * Assign a task to a team member based on the provided query and task body.
   * 
   * @param {Object} query - Query containing task and team member details
   * @param {Object} taskBody - Details of the task to assign
   * @returns {Promise<Object>} - Assigned team member task object
   */
  async assignTask(query, taskBody) {
    try {
      const task = await Task.findOne({ id: query.taskId });

      if (!task) {
        throw new createHttpError(409, "Task not found");
      }

      const taskExistInTeamMember = await TeamMemberTask.findOne({
        taskId: task.id,
        teamMemberWorkdayId: taskBody.teamMemberWorkdayId,
        teamMemberEmail: taskBody.teamMemberEmail,
      });

      if (taskExistInTeamMember) {
        throw new createHttpError(
          409,
          "Team member already has this task assigned"
        );
      }

      const teamMemberTask = new TeamMemberTask({
        ...taskBody,
        taskId: task.id,
      });

      await teamMemberTask.save();
      logger.info(`Task assigned to a team member with ID: ${teamMemberTask._id}`);
      return teamMemberTask;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an assigned task, managing status updates and date handling.
   * 
   * @param {Object} query - Query containing task details
   * @param {Object} taskBody - Details of the task to update
   * @returns {Promise<Object>} - Updated team member task object
   */
  async updateAssignedTask(query, taskBody) {
    try {
      const task = await Task.findOne({ id: query.taskId });

      if (!task) {
        throw new createHttpError(409, "Event not found");
      }

      const teamMemberTask = await TeamMemberTask.findOne({
        taskId: task.id,
        ...query,
      });

      if (!teamMemberTask) {
        throw new createHttpError(409, "Team member task not found");
      }

      // Ensure dates are set based on the new status
      if (taskBody.status === 'inProgress' && teamMemberTask.status !== 'inProgress') {
        taskBody.startedDate = new Date(); // Add startedDate for inProgress
      } else if (taskBody.status === 'completed') {
        if (!teamMemberTask.startedDate) {
          taskBody.startedDate = new Date(); // Add startedDate if missing
        }
        if (teamMemberTask.status !== 'completed') {
          taskBody.completionDate = new Date(); // Add completionDate for completed
        }
      }

      teamMemberTask.set(taskBody);

      await teamMemberTask.save();
      logger.info(`Task updated to a assigned team member with ID: ${teamMemberTask._id}`);
      return teamMemberTask;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Fetch assigned tasks based on dynamic filters or return all tasks if no filters are provided.
   * 
   * @param {Object} filters - Object containing filter criteria
   * @returns {Promise<Array<Object>>} - Array of task details
   */
  async getAssignedTasksByFilters(filters = {}, timezone = 'UTC') {
    const query = {};

    if (filters.taskIds && filters.taskIds.length) {
      query.taskId = { $in: filters.taskIds }; // Matches multiple task IDs
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.teamMemberEmail) {
      query.teamMemberEmail = filters.teamMemberEmail;
    }

    if (filters.teamMemberWorkdayId) {
      query.teamMemberWorkdayId = filters.teamMemberWorkdayId;
    }

    try {
      const tasks = await TeamMemberTask.find(query);
      return tasks.map(task => convertDatesToTimezone(task, timezone));
    } catch (error) {
      logger.error("Error fetching teamMemberTask: " + error.message);
      throw error;
    }
  }

  /**
   * Fetch detailed information about assigned tasks.
   * 
   * @param {Object} query - Query containing task and team member details
   * @returns {Promise<Array<Object>>} - Array of detailed assigned task objects
   */
  async getAssignedTaskDetails(query, timezone = 'UTC') {
    try {

      const teamMemberTasks = await TeamMemberTask.find({
        teamMemberWorkdayId: query.teamMemberWorkdayId,
        teamMemberEmail: query.teamMemberEmail,
      });

      if (!teamMemberTasks.length) {
        return [];
      }

      const taskIds = teamMemberTasks.map(tmt => tmt.taskId);
      const tasks = await Task.find({ id: { $in: taskIds } });

      if (!tasks.length) {
        return [];
      }

      return tasks.map(task => {
        const teamMemberDetails = teamMemberTasks.find(tmt => tmt.taskId === task.id).toObject();
        delete teamMemberDetails.taskId;
        return convertDatesToTimezone({
          ...task.toObject(),
          ...teamMemberDetails
        }, timezone);
      });
    } catch (error) {
      logger.error("Error fetching assigned task details: " + error.message);
      throw error;
    }
  }
}

module.exports = new TaskService();
