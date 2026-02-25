const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CardDemo Modernized API',
    version: '1.0.0',
    description: 'REST API for CardDemo modernization (Node.js + Express + SQLite).'
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local backend server' }
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Menu' },
    { name: 'Users' },
    { name: 'Accounts' },
    { name: 'Cards' },
    { name: 'Transactions' },
    { name: 'Billing' },
    { name: 'Reports' },
    { name: 'Batch' }
  ],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
        description: 'Session cookie returned by /api/v1/auth/login'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                message: { type: 'string' }
              }
            }
          },
          correlationId: { type: 'string' }
        }
      },
      PagedResult: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { type: 'object' } },
          page: { type: 'integer' },
          pageSize: { type: 'integer' },
          total: { type: 'integer' }
        }
      }
    }
  },
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and create session',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'password'],
                properties: {
                  userId: { type: 'string', example: 'A0000001' },
                  password: { type: 'string', example: 'Passw0rd' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Authenticated successfully' },
          '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          '401': { description: 'Authentication failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } }
        }
      }
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Logout current session',
        security: [{ sessionCookie: [] }],
        responses: {
          '204': { description: 'Logged out' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current session user',
        security: [{ sessionCookie: [] }],
        responses: {
          '200': { description: 'Current user payload' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/api/v1/menu/main': {
      get: {
        tags: ['Menu'],
        summary: 'Get main menu options',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'Menu options' }, '401': { description: 'Unauthorized' } }
      }
    },
    '/api/v1/menu/admin': {
      get: {
        tags: ['Menu'],
        summary: 'Get admin menu options',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'Admin options' }, '401': { description: 'Unauthorized' }, '403': { description: 'Forbidden' } }
      }
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List users (admin)',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Paged users', content: { 'application/json': { schema: { $ref: '#/components/schemas/PagedResult' } } } },
          '403': { description: 'Forbidden' }
        }
      },
      post: {
        tags: ['Users'],
        summary: 'Create user (admin)',
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'firstName', 'lastName', 'password', 'userType'],
                properties: {
                  userId: { type: 'string' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  password: { type: 'string' },
                  userType: { type: 'string', enum: ['A', 'U'] }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Validation error' },
          '409': { description: 'Conflict' }
        }
      }
    },
    '/api/v1/users/{userId}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by id (admin)',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'User found' }, '404': { description: 'Not found' } }
      },
      put: {
        tags: ['Users'],
        summary: 'Update user (admin)',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } }
      },
      delete: {
        tags: ['Users'],
        summary: 'Delete user (admin)',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'userId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '204': { description: 'Deleted' }, '404': { description: 'Not found' } }
      }
    },
    '/api/v1/accounts': {
      get: {
        tags: ['Accounts'],
        summary: 'List accounts',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Paged accounts' } }
      }
    },
    '/api/v1/accounts/{acctId}': {
      get: {
        tags: ['Accounts'],
        summary: 'Get account aggregate by id',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'acctId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Account aggregate' }, '404': { description: 'Not found' } }
      },
      put: {
        tags: ['Accounts'],
        summary: 'Update account aggregate',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'acctId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'Updated' }, '400': { description: 'Validation error' } }
      }
    },
    '/api/v1/cards': {
      get: {
        tags: ['Cards'],
        summary: 'List cards',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'acctId', in: 'query', schema: { type: 'string' } },
          { name: 'cardNum', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Paged cards' } }
      }
    },
    '/api/v1/cards/{cardNum}': {
      get: {
        tags: ['Cards'],
        summary: 'Get card aggregate by card number',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'cardNum', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Card aggregate' }, '404': { description: 'Not found' } }
      },
      put: {
        tags: ['Cards'],
        summary: 'Update card',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'cardNum', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Updated' }, '400': { description: 'Validation error' } }
      }
    },
    '/api/v1/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'List transactions',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'acctId', in: 'query', schema: { type: 'string' } },
          { name: 'cardNum', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Paged transactions' } }
      },
      post: {
        tags: ['Transactions'],
        summary: 'Create transaction',
        security: [{ sessionCookie: [] }],
        responses: { '201': { description: 'Created' }, '400': { description: 'Validation error' } }
      }
    },
    '/api/v1/transactions/{tranId}': {
      get: {
        tags: ['Transactions'],
        summary: 'Get transaction by id',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'tranId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Transaction detail' }, '404': { description: 'Not found' } }
      }
    },
    '/api/v1/billing/payments': {
      post: {
        tags: ['Billing'],
        summary: 'Post bill payment',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'Payment posted' }, '400': { description: 'Validation error' } }
      }
    },
    '/api/v1/reports/transactions': {
      post: {
        tags: ['Reports'],
        summary: 'Queue transaction report request',
        security: [{ sessionCookie: [] }],
        responses: { '202': { description: 'Queued' }, '400': { description: 'Validation error' } }
      }
    },
    '/api/v1/reports/transactions/requests': {
      get: {
        tags: ['Reports'],
        summary: 'List report requests',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Paged report requests' } }
      }
    },
    '/api/v1/jobs': {
      get: {
        tags: ['Batch'],
        summary: 'List available batch job definitions',
        security: [{ sessionCookie: [] }],
        responses: { '200': { description: 'Batch jobs list' }, '403': { description: 'Forbidden' } }
      }
    },
    '/api/v1/jobs/capability-matrix': {
      get: {
        tags: ['Batch'],
        summary: 'Get capability classification matrix from latest run per job',
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: 'previewChars',
            in: 'query',
            schema: { type: 'integer', minimum: 80, maximum: 500 },
            description: 'Optional preview snippet length for report/extract content'
          }
        ],
        responses: {
          '200': { description: 'Batch capability matrix' },
          '403': { description: 'Forbidden' }
        }
      }
    },
    '/api/v1/jobs/{jobName}/submit': {
      post: {
        tags: ['Batch'],
        summary: 'Submit a batch job run',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'jobName', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  runMode: { type: 'string', enum: ['manual', 'scheduled', 'replay'] },
                  parameters: { type: 'object' }
                }
              }
            }
          }
        },
        responses: { '202': { description: 'Batch run queued' }, '404': { description: 'Unknown job' }, '409': { description: 'Already running' } }
      }
    },
    '/api/v1/job-runs': {
      get: {
        tags: ['Batch'],
        summary: 'List batch job runs',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'jobName', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'hasRetryPolicy', in: 'query', schema: { type: 'boolean' }, description: 'Filter runs by whether the underlying job definition has explicit retry settings' },
          { name: 'minMaxAttempts', in: 'query', schema: { type: 'integer', minimum: 1 }, description: 'Filter runs where max configured retry attempts across steps is greater than or equal to this value' },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Paged batch runs', content: { 'application/json': { schema: { $ref: '#/components/schemas/PagedResult' } } } }
        }
      }
    },
    '/api/v1/job-runs/{jobRunId}': {
      get: {
        tags: ['Batch'],
        summary: 'Get batch run details including steps',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'jobRunId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Batch run detail' }, '404': { description: 'Not found' } }
      }
    },
    '/api/v1/job-runs/{jobRunId}/logs': {
      get: {
        tags: ['Batch'],
        summary: 'Get aggregated logs for a batch run',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'jobRunId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Combined logs' }, '404': { description: 'Not found' } }
      }
    },
    '/api/v1/job-runs/{jobRunId}/artifacts': {
      get: {
        tags: ['Batch'],
        summary: 'List artifacts for a batch run',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'jobRunId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Artifact list' }, '404': { description: 'Not found' } }
      }
    },
    '/api/v1/job-runs/{jobRunId}/artifacts/{artifactId}': {
      get: {
        tags: ['Batch'],
        summary: 'Download an artifact for a batch run',
        security: [{ sessionCookie: [] }],
        parameters: [
          { name: 'jobRunId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'artifactId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Artifact stream' }, '404': { description: 'Not found' }, '410': { description: 'File missing' } }
      }
    },
    '/api/v1/job-runs/{jobRunId}/restart': {
      post: {
        tags: ['Batch'],
        summary: 'Restart a completed batch run',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'jobRunId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  mode: { type: 'string', enum: ['resume-from-failed-step', 'rerun-all'] }
                }
              }
            }
          }
        },
        responses: { '202': { description: 'Restart run queued' }, '400': { description: 'Invalid restart request' }, '404': { description: 'Not found' } }
      }
    },
    '/api/v1/job-runs/{jobRunId}/cancel': {
      post: {
        tags: ['Batch'],
        summary: 'Cancel a queued or running batch run',
        security: [{ sessionCookie: [] }],
        parameters: [{ name: 'jobRunId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  reason: { type: 'string' }
                }
              }
            }
          }
        },
        responses: { '202': { description: 'Cancellation accepted' }, '400': { description: 'Run already completed' }, '404': { description: 'Not found' } }
      }
    }
  }
};

module.exports = { openApiSpec };
