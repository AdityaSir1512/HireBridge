const axios = require('axios');

/**
 * Profile Update Service
 * Handles updating user profiles with parsed CV data
 */

class ProfileUpdateService {
  constructor() {
    this.userServiceUrl = process.env.USER_SERVICE_URL || 'http://user-service:3001';
  }

  /**
   * Update user profile with parsed CV data
   * @param {string} userId - User ID
   * @param {object} parsedData - Parsed CV data
   * @param {string} token - Auth token (optional)
   * @returns {Promise<object>} Update result
   */
  async updateProfile(userId, parsedData, token = null) {
    try {
      const profileUpdate = this.buildProfileUpdate(parsedData);
      
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.put(
        `${this.userServiceUrl}/api/users/profile/${userId}`,
        profileUpdate,
        { headers }
      );

      return {
        success: true,
        data: response.data,
        updatedFields: Object.keys(profileUpdate.profile || {})
      };
    } catch (error) {
      console.error('Profile update error:', error.message);
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }

  /**
   * Build profile update object from parsed CV data
   * @param {object} parsedData - Parsed CV data
   * @returns {object} Profile update object
   */
  buildProfileUpdate(parsedData) {
    const update = {
      profile: {}
    };

    // Update personal information
    if (parsedData.personal) {
      if (parsedData.personal.phone) {
        update.profile.phone = parsedData.personal.phone;
      }
      if (parsedData.personal.location) {
        update.profile.location = parsedData.personal.location;
      }
      if (parsedData.personal.summary) {
        update.profile.bio = parsedData.personal.summary;
      }
    }

    // Update skills
    if (parsedData.skillsList && parsedData.skillsList.length > 0) {
      update.profile.skills = parsedData.skillsList;
    }

    // Update experience
    if (parsedData.experience && parsedData.experience.length > 0) {
      update.profile.experience = parsedData.experience.map(exp => ({
        company: exp.company,
        role: exp.role,
        startDate: this.parseDate(exp.startDate),
        endDate: exp.current ? null : this.parseDate(exp.endDate),
        current: exp.current || false,
        description: this.buildDescription(exp)
      }));
    }

    // Update education
    if (parsedData.education && parsedData.education.length > 0) {
      update.profile.education = parsedData.education.map(edu => ({
        institution: edu.institution,
        degree: edu.degree,
        field: edu.field,
        startDate: this.parseDate(edu.startDate),
        endDate: this.parseDate(edu.endDate)
      }));
    }

    // Update portfolio/projects
    if (parsedData.projects && parsedData.projects.length > 0) {
      update.profile.portfolio = parsedData.projects.map(proj => ({
        title: proj.name,
        description: proj.description,
        url: proj.url || ''
      }));
    }

    return update;
  }

  /**
   * Build description from experience object
   * @param {object} exp - Experience object
   * @returns {string} Description
   */
  buildDescription(exp) {
    let description = exp.description || '';
    
    if (exp.achievements && exp.achievements.length > 0) {
      if (description) description += '\n\n';
      description += 'Key Achievements:\n' + exp.achievements.map(a => `• ${a}`).join('\n');
    }
    
    return description;
  }

  /**
   * Parse date string to Date object
   * @param {string} dateStr - Date string (YYYY-MM or YYYY)
   * @returns {Date|null} Date object or null
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    try {
      // Handle YYYY-MM format
      if (/^\d{4}-\d{2}$/.test(dateStr)) {
        return new Date(`${dateStr}-01`);
      }
      // Handle YYYY format
      if (/^\d{4}$/.test(dateStr)) {
        return new Date(`${dateStr}-01-01`);
      }
      // Try parsing as is
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Get current user profile
   * @param {string} userId - User ID
   * @param {string} token - Auth token (optional)
   * @returns {Promise<object>} User profile
   */
  async getCurrentProfile(userId, token = null) {
    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.get(
        `${this.userServiceUrl}/api/users/profile/${userId}`,
        { headers }
      );

      return response.data;
    } catch (error) {
      console.error('Get profile error:', error.message);
      return null;
    }
  }

  /**
   * Merge parsed data with existing profile (smart merge)
   * @param {object} currentProfile - Current user profile
   * @param {object} parsedData - Parsed CV data
   * @returns {object} Merged profile update
   */
  mergeWithExisting(currentProfile, parsedData) {
    const update = this.buildProfileUpdate(parsedData);
    
    // If user already has data, we should be more careful about overwriting
    if (currentProfile && currentProfile.profile) {
      const existing = currentProfile.profile;
      
      // Merge skills (combine unique skills)
      if (existing.skills && existing.skills.length > 0) {
        const combinedSkills = [
          ...new Set([
            ...existing.skills,
            ...(update.profile.skills || [])
          ])
        ];
        update.profile.skills = combinedSkills;
      }
      
      // Merge experience (keep existing + add new)
      if (existing.experience && existing.experience.length > 0) {
        // Add new experiences that don't already exist
        const existingCompanies = existing.experience.map(e => 
          e.company?.toLowerCase()
        );
        const newExperiences = (update.profile.experience || []).filter(e => 
          !existingCompanies.includes(e.company?.toLowerCase())
        );
        update.profile.experience = [
          ...existing.experience,
          ...newExperiences
        ];
      }
      
      // Similar merge for education
      if (existing.education && existing.education.length > 0) {
        const existingInstitutions = existing.education.map(e => 
          e.institution?.toLowerCase()
        );
        const newEducation = (update.profile.education || []).filter(e => 
          !existingInstitutions.includes(e.institution?.toLowerCase())
        );
        update.profile.education = [
          ...existing.education,
          ...newEducation
        ];
      }
      
      // Keep existing personal info if not in parsed data
      if (existing.phone && !update.profile.phone) {
        update.profile.phone = existing.phone;
      }
      if (existing.location && !update.profile.location) {
        update.profile.location = existing.location;
      }
      if (existing.bio && !update.profile.bio) {
        update.profile.bio = existing.bio;
      }
    }
    
    return update;
  }

  /**
   * Update profile with smart merge
   * @param {string} userId - User ID
   * @param {object} parsedData - Parsed CV data
   * @param {string} token - Auth token (optional)
   * @param {boolean} merge - Whether to merge with existing data
   * @returns {Promise<object>} Update result
   */
  async updateProfileSmart(userId, parsedData, token = null, merge = true) {
    try {
      let profileUpdate;
      
      if (merge) {
        const currentProfile = await this.getCurrentProfile(userId, token);
        profileUpdate = this.mergeWithExisting(currentProfile, parsedData);
      } else {
        profileUpdate = this.buildProfileUpdate(parsedData);
      }
      
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await axios.put(
        `${this.userServiceUrl}/api/users/profile/${userId}`,
        profileUpdate,
        { headers }
      );

      return {
        success: true,
        data: response.data,
        updatedFields: Object.keys(profileUpdate.profile || {}),
        merged: merge
      };
    } catch (error) {
      console.error('Smart profile update error:', error.message);
      throw new Error(`Failed to update profile: ${error.message}`);
    }
  }
}

module.exports = new ProfileUpdateService();
