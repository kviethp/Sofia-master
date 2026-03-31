import path from 'node:path';

import {getRuntimePaths} from './paths.js';

const BUILTIN_TEMPLATES = [
  {
    id: 'default',
    name: 'Default Delivery',
    description: 'Balanced multi-phase workflow for general delivery work.',
    defaults: {
      risk: 'medium',
      workflowTemplate: 'planner_builder_verifier'
    }
  },
  {
    id: 'webapp-basic',
    name: 'Webapp Basic',
    description: 'Low-risk web app scaffolding and golden path demos.',
    defaults: {
      risk: 'low',
      workflowTemplate: 'builder_only'
    }
  },
  {
    id: 'ops-rapid-response',
    name: 'Ops Rapid Response',
    description: 'Fast-path execution for small operational changes.',
    defaults: {
      risk: 'medium',
      workflowTemplate: 'builder_only'
    }
  },
  {
    id: 'high-assurance',
    name: 'High Assurance',
    description: 'Planner-builder-verifier workflow with approval-friendly defaults.',
    defaults: {
      risk: 'high',
      workflowTemplate: 'planner_builder_verifier'
    }
  }
];

function toTemplateRecord(template) {
  const runtime = getRuntimePaths();
  return {
    ...template,
    path: path.join(runtime.rootDir, 'templates', 'projects', template.id)
  };
}

export function listProjectTemplates() {
  return BUILTIN_TEMPLATES.map(toTemplateRecord);
}

export function getProjectTemplate(templateId) {
  const normalizedId = String(templateId || 'default').trim().toLowerCase();
  const template = BUILTIN_TEMPLATES.find((entry) => entry.id === normalizedId);
  return template ? toTemplateRecord(template) : null;
}

export function applyProjectTemplate(input = {}) {
  const template = getProjectTemplate(input.templateId || 'default');
  if (!template) {
    throw new Error(`Unknown project template: ${input.templateId}`);
  }

  return {
    ...template.defaults,
    ...input,
    templateId: template.id
  };
}
