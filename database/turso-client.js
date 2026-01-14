// Turso Client Adapter for Cloudflare Workers
// Provides D1-compatible API using Turso/libSQL

import { createClient } from '@libsql/client';

let tursoClient = null;

/**
 * Get or create Turso client instance (singleton)
 */
export function getTursoClient(env) {
  if (!tursoClient) {
    tursoClient = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
      intMode: 'number', // Return integers as numbers, not BigInt
    });
  }
  return tursoClient;
}

/**
 * Adapter class to make Turso API compatible with D1 API
 * This allows minimal code changes when migrating from D1 to Turso
 */
export class TursoAdapter {
  constructor(client) {
    this.client = client;
  }

  /**
   * Prepare a SQL statement (D1-compatible API)
   * @param {string} sql - SQL query
   * @returns {object} - Object with bind method and direct execution methods
   */
  prepare(sql) {
    const client = this.client;
    
    // Create execution methods
    const executionMethods = {
      /**
       * Execute query and return first row
       * @returns {Promise<object|null>}
       */
      first: async () => {
        try {
          const result = await client.execute({ sql, args: [] });
          return result.rows[0] || null;
        } catch (error) {
          console.error('Turso first() error:', error);
          throw error;
        }
      },

      /**
       * Execute query and return all rows
       * @returns {Promise<{results: Array}>}
       */
      all: async () => {
        try {
          const result = await client.execute({ sql, args: [] });
          return { results: result.rows };
        } catch (error) {
          console.error('Turso all() error:', error);
          throw error;
        }
      },

      /**
       * Execute query (INSERT, UPDATE, DELETE)
       * @returns {Promise<{success: boolean, meta: object}>}
       */
      run: async () => {
        try {
          const result = await client.execute({ sql, args: [] });
          return {
            success: true,
            meta: {
              changes: result.rowsAffected,
              last_row_id: result.lastInsertRowid,
              duration: result.duration || 0,
            },
          };
        } catch (error) {
          console.error('Turso run() error:', error);
          return {
            success: false,
            error: error.message,
          };
        }
      },

      /**
       * Bind parameters to the prepared statement
       * @param {...any} params - Parameters to bind
       * @returns {object} - Object with first, all, and run methods
       */
      bind: (...params) => ({
        first: async () => {
          try {
            const result = await client.execute({ sql, args: params });
            return result.rows[0] || null;
          } catch (error) {
            console.error('Turso first() error:', error);
            throw error;
          }
        },

        all: async () => {
          try {
            const result = await client.execute({ sql, args: params });
            return { results: result.rows };
          } catch (error) {
            console.error('Turso all() error:', error);
            throw error;
          }
        },

        run: async () => {
          try {
            const result = await client.execute({ sql, args: params });
            return {
              success: true,
              meta: {
                changes: result.rowsAffected,
                last_row_id: result.lastInsertRowid,
                duration: result.duration || 0,
              },
            };
          } catch (error) {
            console.error('Turso run() error:', error);
            return {
              success: false,
              error: error.message,
            };
          }
        },
      }),
    };

    return executionMethods;
  }

  /**
   * Execute a batch of SQL statements (transaction)
   * @param {Array<{sql: string, params: Array}>} statements
   * @returns {Promise<Array>}
   */
  async batch(statements) {
    try {
      const results = await this.client.batch(
        statements.map(stmt => ({
          sql: stmt.sql,
          args: stmt.params || [],
        })),
        'write' // Transaction mode
      );
      
      return results.map(result => ({
        success: true,
        results: result.rows,
        meta: {
          changes: result.rowsAffected,
          last_row_id: result.lastInsertRowid,
        },
      }));
    } catch (error) {
      console.error('Turso batch() error:', error);
      throw error;
    }
  }

  /**
   * Execute raw SQL (for migrations, etc.)
   * @param {string} sql
   * @returns {Promise<object>}
   */
  async exec(sql) {
    try {
      const result = await this.client.execute(sql);
      return {
        success: true,
        results: result.rows,
        meta: {
          changes: result.rowsAffected,
        },
      };
    } catch (error) {
      console.error('Turso exec() error:', error);
      throw error;
    }
  }
}

/**
 * Initialize Turso database connection for Cloudflare Workers
 * @param {object} env - Environment variables
 * @returns {TursoAdapter} - D1-compatible database adapter
 */
export function initTurso(env) {
  const client = getTursoClient(env);
  return new TursoAdapter(client);
}
