export const PLAYER_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    public: {
      type: 'object',
      properties: {
        tldr: { type: 'string' },
        highlight: { type: 'string' },
        focus_area: { type: 'string' },
        role_involvement_pct: { type: 'number' },
        role_involvement_one_liner: { type: 'string' },
      },
      required: [
        'tldr',
        'highlight',
        'focus_area',
        'role_involvement_pct',
        'role_involvement_one_liner',
      ],
    },
    private: {
      type: 'object',
      properties: {
        tldr: { type: 'string' },
        did_well: { type: 'array', items: { type: 'string' } },
        improve: { type: 'array', items: { type: 'string' } },
        coaching_tip: { type: 'string' },
        role_involvement: {
          type: 'object',
          properties: {
            pct: { type: 'number' },
            criteria: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  score_pct: { type: 'number' },
                  evidence: { type: 'string' },
                },
                required: ['name', 'score_pct', 'evidence'],
              },
            },
          },
          required: ['pct', 'criteria'],
        },
      },
      required: ['tldr', 'did_well', 'improve', 'coaching_tip', 'role_involvement'],
    },
  },
  required: ['public', 'private'],
} as const

export const TEAM_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    tldr: { type: 'string' },
    what_worked: { type: 'array', items: { type: 'string' } },
    what_to_fix: { type: 'array', items: { type: 'string' } },
    next_match_focus: { type: 'string' },
  },
  required: ['tldr', 'what_worked', 'what_to_fix', 'next_match_focus'],
} as const
