import { API_ENDPOINTS } from '../endpoints'
import { apiClient, USE_MOCK_API } from '../http'

const wait = (ms = 400) => new Promise((resolve) => window.setTimeout(resolve, ms))

const MOCK_INTERVIEW_SESSION = {
  interviewId: 'mock-interview-001',
  employeeId: 'emp-001',
  status: 'in-progress',
  currentQuestion: 1,
  totalQuestions: 10,
  startedAt: new Date().toISOString(),
  extractedSkills: [
    { name: 'React', level: 'proficient', yearsOfExperience: 3 },
    { name: 'Node.js', level: 'intermediate', yearsOfExperience: 2 },
    { name: 'JavaScript', level: 'proficient', yearsOfExperience: 5 },
    { name: 'TypeScript', level: 'beginner', yearsOfExperience: 1 },
    { name: 'SQL', level: 'intermediate', yearsOfExperience: 3 },
  ],
}

const MOCK_EVALUATION = {
  interviewId: 'mock-interview-001',
  completedAt: new Date().toISOString(),
  scoreboardSummary: {
    overallScore: 78,
    communicationRating: 8,
    technicalProficiency: 7.5,
    problemSolving: 7.2,
    interviewDuration: 45,
  },
  skillsEvaluation: [
    {
      skill: 'React',
      rating: 4.2,
      feedback:
        'Strong understanding of React fundamentals and hooks. Demonstrated good knowledge of component lifecycle and state management.',
      topicsCovered: ['Component Lifecycle', 'Hooks', 'State Management', 'Performance Optimization'],
      improvements: 'Advanced patterns like render props and code splitting could be explored further.',
    },
    {
      skill: 'JavaScript',
      rating: 4.5,
      feedback:
        'Excellent JavaScript foundation with solid grasp of ES6+ features. Clear understanding of closure and async operations.',
      topicsCovered: ['ES6+ Features', 'Async/Await', 'Closures', 'Event Loop'],
      improvements: 'Deep dive into performance optimization and memory management would strengthen expertise.',
    },
    {
      skill: 'Node.js',
      rating: 3.8,
      feedback:
        'Good working knowledge of Node.js and Express. Understands middleware and routing concepts.',
      topicsCovered: ['Express Basics', 'Middleware', 'Routing', 'Request/Response Handling'],
      improvements: 'Database integration and advanced error handling patterns need strengthening.',
    },
    {
      skill: 'TypeScript',
      rating: 3.0,
      feedback:
        'Basic understanding of TypeScript. Can write simple typed code but struggles with advanced type system features.',
      topicsCovered: ['Basic Types', 'Interfaces', 'Generics Basics'],
      improvements: 'Advanced generics, utility types, and conditional types require more practice.',
    },
    {
      skill: 'SQL',
      rating: 3.5,
      feedback:
        'Solid understanding of basic SQL queries. Can write joins and subqueries with some guidance.',
      topicsCovered: ['SELECT Queries', 'JOINs', 'Aggregations', 'Subqueries'],
      improvements: 'Query optimization and advanced indexing strategies should be focused on.',
    },
  ],
  strengths: [
    'Excellent problem-solving ability',
    'Strong communication skills',
    'Quick learner with practical implementation experience',
    'Good understanding of web technologies fundamentals',
    'Ability to explain complex concepts clearly',
  ],
  weaknesses: [
    'Limited experience with TypeScript advanced features',
    'Could improve on system design principles',
    'Database optimization knowledge is basic',
    'DevOps and deployment practices not thoroughly covered',
  ],
  skillGaps: [
    {
      skill: 'TypeScript Advanced Patterns',
      priority: 'High',
      estimatedResolutionTime: '4-6 weeks',
      reasoning: 'Current role requires advanced type management',
    },
    {
      skill: 'System Design',
      priority: 'High',
      estimatedResolutionTime: '8-10 weeks',
      reasoning: 'Essential for senior position progression',
    },
    {
      skill: 'Database Optimization',
      priority: 'Medium',
      estimatedResolutionTime: '4 weeks',
      reasoning: 'Performance-critical applications need this expertise',
    },
    {
      skill: 'DevOps & Deployment',
      priority: 'Medium',
      estimatedResolutionTime: '6 weeks',
      reasoning: 'Modern development workflows require deployment knowledge',
    },
    {
      skill: 'GraphQL',
      priority: 'Low',
      estimatedResolutionTime: '3-4 weeks',
      reasoning: 'Emerging technology for future-proofing skills',
    },
  ],
  recommendedCourses: [
    {
      title: 'TypeScript Advanced Patterns & Techniques',
      provider: 'Udemy',
      duration: '12 hours',
      difficulty: 'Advanced',
      skillAlignment: ['TypeScript Advanced Patterns'],
      estimatedCompletion: '2 weeks',
      priority: 'High',
      description: 'Master advanced TypeScript patterns including generics, conditional types, and utility types.',
    },
    {
      title: 'System Design Interview Mastery',
      provider: 'Educative',
      duration: '30 hours',
      difficulty: 'Advanced',
      skillAlignment: ['System Design'],
      estimatedCompletion: '6-8 weeks',
      priority: 'High',
      description: 'Learn how to design scalable systems, databases, and APIs used by top companies.',
    },
    {
      title: 'Database Optimization & Advanced SQL',
      provider: 'DataCamp',
      duration: '15 hours',
      difficulty: 'Intermediate',
      skillAlignment: ['Database Optimization'],
      estimatedCompletion: '3-4 weeks',
      priority: 'Medium',
      description: 'Deep dive into query optimization, indexing, and performance tuning strategies.',
    },
    {
      title: 'DevOps Fundamentals: Docker & Kubernetes',
      provider: 'Linux Academy',
      duration: '20 hours',
      difficulty: 'Intermediate',
      skillAlignment: ['DevOps & Deployment'],
      estimatedCompletion: '4-5 weeks',
      priority: 'Medium',
      description: 'Master containerization and orchestration for modern application deployment.',
    },
    {
      title: 'GraphQL: The Complete Guide',
      provider: 'Udemy',
      duration: '18 hours',
      difficulty: 'Intermediate',
      skillAlignment: ['GraphQL'],
      estimatedCompletion: '3-4 weeks',
      priority: 'Low',
      description: 'Learn GraphQL from scratch to build modern APIs and improve data fetching.',
    },
  ],
  actionPlan: {
    shortTerm: [
      'Complete TypeScript Advanced Patterns course by week 4',
      'Implement typed project using advanced patterns',
      'Review system design fundamentals daily (30 min)',
    ],
    mediumTerm: [
      'Complete System Design course by week 12',
      'Refactor current project with system design principles',
      'Start Database Optimization course by week 8',
    ],
    longTerm: [
      'Build one production-ready system by month 6',
      'Mentor junior developers on best practices',
      'Explore GraphQL for next project',
    ],
  },
  nextSteps: [
    {
      step: 1,
      action: 'Enroll in TypeScript Advanced Patterns course',
      dueDate: '2026-03-31',
      status: 'pending',
    },
    {
      step: 2,
      action: 'Schedule 1-on-1 with mentor to discuss career growth',
      dueDate: '2026-03-28',
      status: 'pending',
    },
    {
      step: 3,
      action: 'Create learning schedule for skill gap resolution',
      dueDate: '2026-04-07',
      status: 'pending',
    },
  ],
}

export const interviewService = {
  async startInterview() {
    if (USE_MOCK_API) {
      await wait(500)
      return MOCK_INTERVIEW_SESSION
    }

    const response = await apiClient.post(API_ENDPOINTS.employee.interview.start)
    return response.data
  },

  async uploadResume(file) {
    if (USE_MOCK_API) {
      await wait(800)
      return {
        success: true,
        resumeId: 'resume-001',
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
      }
    }

    const formData = new FormData()
    formData.append('resume', file)

    const response = await apiClient.post(API_ENDPOINTS.employee.interview.uploadResume, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  async extractSkills(resumeId) {
    if (USE_MOCK_API) {
      await wait(1000)
      return {
        skills: MOCK_INTERVIEW_SESSION.extractedSkills,
        summary: 'React developer with 5 years of JavaScript experience and 3 years of Node.js backend development.',
      }
    }

    const response = await apiClient.post(API_ENDPOINTS.employee.interview.extractSkills, {
      resumeId,
    })
    return response.data
  },

  async getNextQuestion(interviewId, questionNumber) {
    if (USE_MOCK_API) {
      await wait(600)
      const questions = [
        {
          questionId: 'q-001',
          questionNumber: 1,
          text: 'Tell me about your experience with React and explain how you would approach building a scalable component architecture.',
          skillBased: 'React',
          difficulty: 'Intermediate',
          audioUrl: null,
        },
        {
          questionId: 'q-002',
          questionNumber: 2,
          text: 'Can you walk us through a challenging JavaScript problem you recently solved? What was your approach?',
          skillBased: 'JavaScript',
          difficulty: 'Intermediate',
          audioUrl: null,
        },
        {
          questionId: 'q-003',
          questionNumber: 3,
          text: 'How do you typically handle state management in large React applications? What patterns have you used?',
          skillBased: 'React',
          difficulty: 'Advanced',
          audioUrl: null,
        },
        {
          questionId: 'q-004',
          questionNumber: 4,
          text: 'Describe your experience with async programming in JavaScript. How do you handle complex async operations?',
          skillBased: 'JavaScript',
          difficulty: 'Intermediate',
          audioUrl: null,
        },
        {
          questionId: 'q-005',
          questionNumber: 5,
          text: 'What Node.js frameworks have you used? Can you discuss the benefits of Express and how you structure your projects?',
          skillBased: 'Node.js',
          difficulty: 'Intermediate',
          audioUrl: null,
        },
      ]
      return questions[Math.min(questionNumber - 1, questions.length - 1)]
    }

    const response = await apiClient.post(API_ENDPOINTS.employee.interview.getQuestion, {
      interviewId,
      questionNumber,
    })
    return response.data
  },

  async submitAnswer(interviewId, questionId, answer, audioUrl) {
    if (USE_MOCK_API) {
      await wait(1000)
      return {
        success: true,
        answerRecorded: true,
        answerAnalysis: {
          relevance: 0.85,
          completeness: 0.78,
          clarity: 0.88,
          confidence: 0.82,
          feedback: 'Good answer with clear explanation. Could have provided more specific examples.',
        },
      }
    }

    const response = await apiClient.post(API_ENDPOINTS.employee.interview.submitAnswer, {
      interviewId,
      questionId,
      answer,
      audioUrl,
      timestamp: new Date().toISOString(),
    })
    return response.data
  },

  async completeInterview(interviewId) {
    if (USE_MOCK_API) {
      await wait(1500)
      return {
        success: true,
        interviewId,
        completedAt: new Date().toISOString(),
        evaluationInProgress: true,
      }
    }

    const response = await apiClient.post(API_ENDPOINTS.employee.interview.complete, {
      interviewId,
    })
    return response.data
  },

  async getInterviewResults(interviewId) {
    if (USE_MOCK_API) {
      await wait(800)
      return MOCK_EVALUATION
    }

    const response = await apiClient.get(API_ENDPOINTS.employee.interview.getResults(interviewId))
    return response.data
  },

  async getInterviewHistory() {
    if (USE_MOCK_API) {
      await wait(500)
      return [
        {
          interviewId: 'mock-interview-001',
          completedAt: '2026-03-20T14:30:00Z',
          overallScore: 78,
          skillsFocused: ['React', 'JavaScript', 'Node.js'],
          status: 'completed',
        },
        {
          interviewId: 'mock-interview-002',
          completedAt: '2026-02-15T10:15:00Z',
          overallScore: 72,
          skillsFocused: ['JavaScript', 'SQL'],
          status: 'completed',
        },
      ]
    }

    const response = await apiClient.get(API_ENDPOINTS.employee.interview.history)
    return response.data
  },
}
