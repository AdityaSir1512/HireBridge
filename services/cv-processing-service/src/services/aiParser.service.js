const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

/**
 * AI Parser Service - Supports multiple AI models for CV parsing
 * Models supported: OpenAI GPT-4, Anthropic Claude, Hugging Face
 */

class AIParserService {
  constructor() {
    this.openaiClient = null;
    this.anthropicClient = null;
    this.defaultModel = process.env.AI_PARSER_MODEL || 'openai';
    
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
    
    // Initialize Anthropic if API key is available
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
    }
  }

  /**
   * Parse CV text using AI models
   * @param {string} cvText - Extracted text from CV
   * @param {string} model - Model to use ('openai', 'claude', 'huggingface')
   * @returns {Promise<object>} Parsed CV data
   */
  async parseCV(cvText, model = this.defaultModel) {
    try {
      switch (model.toLowerCase()) {
        case 'openai':
          return await this.parseWithOpenAI(cvText);
        case 'claude':
          return await this.parseWithClaude(cvText);
        case 'huggingface':
          return await this.parseWithHuggingFace(cvText);
        default:
          // Try models in order of preference
          if (this.openaiClient) return await this.parseWithOpenAI(cvText);
          if (this.anthropicClient) return await this.parseWithClaude(cvText);
          return await this.parseWithHuggingFace(cvText);
      }
    } catch (error) {
      console.error('AI parsing failed with primary model, trying fallback:', error.message);
      // Try fallback models
      return await this.parseWithFallback(cvText, model);
    }
  }

  /**
   * Parse CV using OpenAI GPT-4
   */
  async parseWithOpenAI(cvText) {
    if (!this.openaiClient) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = this.buildParsingPrompt(cvText);
    
    const response = await this.openaiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert CV/Resume parser. Extract structured information from CVs with high accuracy. Always respond with valid JSON only, no additional text.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(response.choices[0].message.content);
    return this.standardizeOutput(parsedData);
  }

  /**
   * Parse CV using Anthropic Claude
   */
  async parseWithClaude(cvText) {
    if (!this.anthropicClient) {
      throw new Error('Anthropic API key not configured');
    }

    const prompt = this.buildParsingPrompt(cvText);
    
    const response = await this.anthropicClient.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-opus-20240229',
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: `You are an expert CV/Resume parser. Extract structured information from CVs with high accuracy. Always respond with valid JSON only.\n\n${prompt}`
        }
      ]
    });

    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Claude response');
    }
    
    const parsedData = JSON.parse(jsonMatch[0]);
    return this.standardizeOutput(parsedData);
  }

  /**
   * Parse CV using Hugging Face models (free alternative)
   */
  async parseWithHuggingFace(cvText) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    const prompt = this.buildParsingPrompt(cvText);
    
    try {
      const response = await axios.post(
        'https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1',
        {
          inputs: prompt,
          parameters: {
            max_new_tokens: 2048,
            temperature: 0.1,
            return_full_text: false
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const generatedText = response.data[0].generated_text;
      const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to extract JSON from Hugging Face response');
      }
      
      const parsedData = JSON.parse(jsonMatch[0]);
      return this.standardizeOutput(parsedData);
    } catch (error) {
      console.error('Hugging Face parsing error:', error.message);
      // Fallback to rule-based parsing
      return this.ruleBasedParsing(cvText);
    }
  }

  /**
   * Fallback parsing when primary model fails
   */
  async parseWithFallback(cvText, failedModel) {
    const models = ['openai', 'claude', 'huggingface'];
    const remainingModels = models.filter(m => m !== failedModel.toLowerCase());
    
    for (const model of remainingModels) {
      try {
        return await this.parseCV(cvText, model);
      } catch (error) {
        console.error(`Fallback parsing with ${model} failed:`, error.message);
        continue;
      }
    }
    
    // Last resort: rule-based parsing
    console.log('All AI models failed, using rule-based parsing');
    return this.ruleBasedParsing(cvText);
  }

  /**
   * Build the prompt for AI models
   */
  buildParsingPrompt(cvText) {
    return `Extract the following information from this CV/Resume and return it as a JSON object.

CV Text:
${cvText}

Extract and return a JSON object with this exact structure:
{
  "personal": {
    "name": "Full name",
    "email": "Email address",
    "phone": "Phone number",
    "location": "Location/Address",
    "linkedin": "LinkedIn URL",
    "github": "GitHub URL",
    "portfolio": "Portfolio URL",
    "summary": "Professional summary or objective"
  },
  "skills": {
    "technical": ["List of technical skills"],
    "soft": ["List of soft skills"],
    "languages": ["Programming languages"],
    "tools": ["Tools and technologies"]
  },
  "experience": [
    {
      "company": "Company name",
      "role": "Job title",
      "location": "Location",
      "startDate": "Start date (YYYY-MM format)",
      "endDate": "End date (YYYY-MM format) or null if current",
      "current": true/false,
      "description": "Job description",
      "achievements": ["List of achievements/responsibilities"]
    }
  ],
  "education": [
    {
      "institution": "Institution name",
      "degree": "Degree type",
      "field": "Field of study",
      "location": "Location",
      "startDate": "Start date (YYYY-MM format)",
      "endDate": "End date (YYYY-MM format)",
      "gpa": "GPA if mentioned",
      "achievements": ["Honors, awards, etc."]
    }
  ],
  "certifications": [
    {
      "name": "Certification name",
      "issuer": "Issuing organization",
      "date": "Date obtained",
      "expiryDate": "Expiry date if applicable",
      "credentialId": "Credential ID if mentioned"
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Project description",
      "technologies": ["Technologies used"],
      "url": "Project URL if mentioned",
      "date": "Date or time period"
    }
  ],
  "awards": [
    {
      "name": "Award name",
      "issuer": "Issuing organization",
      "date": "Date received",
      "description": "Description"
    }
  ],
  "publications": [
    {
      "title": "Publication title",
      "publisher": "Publisher",
      "date": "Publication date",
      "url": "URL if available"
    }
  ]
}

Important:
- Extract only information that is explicitly mentioned in the CV
- Use null for missing information
- Format dates consistently as YYYY-MM or YYYY
- Combine all skills into appropriate categories
- Be precise and accurate
- Return ONLY the JSON object, no additional text`;
  }

  /**
   * Standardize output format from different AI models
   */
  standardizeOutput(parsedData) {
    // Ensure all required fields exist
    const standardized = {
      personal: parsedData.personal || {},
      skills: {
        technical: [],
        soft: [],
        languages: [],
        tools: [],
        ...(parsedData.skills || {})
      },
      experience: parsedData.experience || [],
      education: parsedData.education || [],
      certifications: parsedData.certifications || [],
      projects: parsedData.projects || [],
      awards: parsedData.awards || [],
      publications: parsedData.publications || []
    };

    // Flatten skills into a single array for user profile
    const allSkills = [
      ...(standardized.skills.technical || []),
      ...(standardized.skills.soft || []),
      ...(standardized.skills.languages || []),
      ...(standardized.skills.tools || [])
    ];
    standardized.skillsList = [...new Set(allSkills)]; // Remove duplicates

    return standardized;
  }

  /**
   * Rule-based parsing as final fallback (no AI required)
   */
  ruleBasedParsing(cvText) {
    const lines = cvText.split('\n').filter(line => line.trim());
    
    return {
      personal: this.extractPersonalInfo(cvText),
      skills: this.extractSkills(cvText),
      experience: this.extractExperience(lines),
      education: this.extractEducation(lines),
      certifications: [],
      projects: [],
      awards: [],
      publications: [],
      skillsList: this.extractSkills(cvText).technical || []
    };
  }

  extractPersonalInfo(text) {
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/;
    const phoneRegex = /[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}/;
    const linkedinRegex = /linkedin\.com\/in\/[\w-]+/i;
    const githubRegex = /github\.com\/[\w-]+/i;

    return {
      name: text.split('\n')[0]?.trim() || null,
      email: text.match(emailRegex)?.[0] || null,
      phone: text.match(phoneRegex)?.[0] || null,
      linkedin: text.match(linkedinRegex)?.[0] || null,
      github: text.match(githubRegex)?.[0] || null
    };
  }

  extractSkills(text) {
    const skillKeywords = [
      'JavaScript', 'Python', 'Java', 'C++', 'C#', 'Ruby', 'PHP', 'Swift', 'Go', 'Rust',
      'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
      'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS', 'Azure',
      'Git', 'CI/CD', 'Agile', 'Scrum', 'REST', 'GraphQL', 'TypeScript', 'HTML', 'CSS'
    ];

    const foundSkills = skillKeywords.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );

    return {
      technical: foundSkills,
      soft: [],
      languages: [],
      tools: []
    };
  }

  extractExperience(lines) {
    // Simple heuristic: look for common job-related keywords
    const experiences = [];
    // This is a basic implementation - AI models are much better
    return experiences;
  }

  extractEducation(lines) {
    // Simple heuristic: look for degree keywords
    const education = [];
    // This is a basic implementation - AI models are much better
    return education;
  }

  /**
   * Generate career suggestions based on parsed CV
   */
  async generateSuggestions(parsedData) {
    try {
      const skills = parsedData.skillsList || [];
      const experience = parsedData.experience || [];
      
      // Categorize based on skills and experience
      const suggestions = {
        jobTypes: [],
        industries: [],
        roles: [],
        nextSkills: []
      };

      // Job type suggestions
      if (experience.length === 0) {
        suggestions.jobTypes.push('entry_level', 'internship');
      } else if (experience.length >= 5) {
        suggestions.jobTypes.push('senior', 'lead', 'management');
      } else {
        suggestions.jobTypes.push('mid_level', 'full_time');
      }

      // Industry suggestions based on skills
      const webSkills = ['React', 'Angular', 'Vue', 'JavaScript', 'HTML', 'CSS'];
      const backendSkills = ['Node.js', 'Python', 'Java', 'Django', 'Spring'];
      const dataSkills = ['Python', 'SQL', 'MongoDB', 'PostgreSQL'];
      
      if (skills.some(s => webSkills.includes(s))) {
        suggestions.roles.push('Frontend Developer', 'Full Stack Developer');
      }
      if (skills.some(s => backendSkills.includes(s))) {
        suggestions.roles.push('Backend Developer', 'Full Stack Developer');
      }
      if (skills.some(s => dataSkills.includes(s))) {
        suggestions.roles.push('Data Engineer', 'Backend Developer');
      }

      return suggestions;
    } catch (error) {
      console.error('Error generating suggestions:', error);
      return {
        jobTypes: ['full_time'],
        industries: [],
        roles: [],
        nextSkills: []
      };
    }
  }
}

module.exports = new AIParserService();
