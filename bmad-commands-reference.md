# BMAD Commands Reference

Complete listing of all available BMAD commands organized by module and phase.

---

## 📦 BMB Module (BMAD Builder)
**Purpose:** Create and manage BMAD agents, modules, and workflows

### Agent Management
| Code | Command | Description |
|------|---------|-------------|
| CA | `bmad_bmb_create_agent` | Create a new BMAD agent with best practices and compliance |
| EA | `bmad_bmb_edit_agent` | Edit existing BMAD agents while maintaining compliance |
| VA | `bmad_bmb_validate_agent` | Validate existing BMAD agents and offer to improve deficiencies |

### Module Management
| Code | Command | Description |
|------|---------|-------------|
| PB | `bmad_bmb_create_module_brief` | Create product brief for BMAD module development |
| CM | `bmad_bmb_create_module` | Create a complete BMAD module with agents, workflows, and infrastructure |
| EM | `bmad_bmb_edit_module` | Edit existing BMAD modules while maintaining coherence |
| VM | `bmad_bmb_validate_module` | Run compliance check on BMAD modules against best practices |

### Workflow Management
| Code | Command | Description |
|------|---------|-------------|
| CW | `bmad_bmb_create_workflow` | Create a new BMAD workflow with proper structure and best practices |
| EW | `bmad_bmb_edit_workflow` | Edit existing BMAD workflows while maintaining integrity |
| VW | `bmad_bmb_validate_workflow` | Run validation check on BMAD workflows against best practices |
| MV | `bmad_bmb_validate_max_parallel` | Run validation checks in MAX-PARALLEL mode against a workflow |
| RW | `bmad_bmb_rework_workflow` | Rework a Workflow to a V6 Compliant Version |

---

## 🚀 BMM Module (BMAD Method Manager)
**Purpose:** Full software development lifecycle management

### Phase 0: Anytime Commands
| Code | Command | Description |
|------|---------|-------------|
| DP | `bmad-bmm-document-project` | Analyze an existing project to produce useful documentation |
| GPC | `bmad-bmm-generate-project-context` | Scan existing codebase to generate lean LLM-optimized project-context.md |
| QS | `bmad-bmm-quick-spec` | Quick one-off tasks - create tech spec without extensive planning |
| QD | `bmad-bmm-quick-dev` | Quick one-off tasks - implement without extensive planning |
| CC | `bmad-bmm-correct-course` | Navigate significant changes during development |
| WD | (tech-writer agent) | Write documentation following best practices |
| US | (tech-writer agent) | Update documentation standards in agent memory |
| MG | (tech-writer agent) | Create Mermaid diagrams based on user description |
| VD | (tech-writer agent) | Validate document against documentation standards |
| EC | (tech-writer agent) | Create clear technical explanations for complex concepts |

### Phase 1: Analysis
| Code | Command | Description |
|------|---------|-------------|
| BP | `bmad-brainstorming` | Expert guided facilitation through brainstorming techniques |
| MR | `bmad-bmm-market-research` | Market analysis, competitive landscape, customer needs |
| DR | `bmad-bmm-domain-research` | Industry domain deep dive, subject matter expertise |
| TR | `bmad-bmm-technical-research` | Technical feasibility, architecture options |
| CB | `bmad-bmm-create-product-brief` | Guided experience to nail down your product idea |

### Phase 2: Planning
| Code | Command | Description | Required |
|------|---------|-------------|----------|
| CP | `bmad-bmm-create-prd` | Expert led facilitation to produce Product Requirements Document | ✅ |
| VP | `bmad-bmm-validate-prd` | Validate PRD is comprehensive, lean, well organized |  |
| EP | `bmad-bmm-edit-prd` | Improve and enhance an existing PRD |  |
| CU | `bmad-bmm-create-ux-design` | Guidance through UX planning (recommended for UI projects) |  |

### Phase 3: Solutioning
| Code | Command | Description | Required |
|------|---------|-------------|----------|
| CA | `bmad-bmm-create-architecture` | Guided workflow to document technical decisions | ✅ |
| CE | `bmad-bmm-create-epics-and-stories` | Create the Epics and Stories listing | ✅ |
| IR | `bmad-bmm-check-implementation-readiness` | Ensure PRD, UX, Architecture and Epics/Stories are aligned | ✅ |

### Phase 4: Implementation
| Code | Command | Description | Required |
|------|---------|-------------|----------|
| SP | `bmad-bmm-sprint-planning` | Generate sprint plan for development tasks | ✅ |
| SS | `bmad-bmm-sprint-status` | Summarize sprint status and route to next workflow |  |
| CS | `bmad-bmm-create-story` | Prepare story with context for implementation | ✅ |
| VS | `bmad-bmm-create-story` (Validate Mode) | Validate story readiness before development |  |
| DS | `bmad-bmm-dev-story` | Execute story implementation tasks and tests | ✅ |
| CR | `bmad-bmm-code-review` | Review implemented code for issues |  |
| QA | `bmad-bmm-qa-automate` | Generate automated API and E2E tests |  |
| ER | `bmad-bmm-retrospective` | Review completed work, lessons learned |  |

---

## 🧪 Core Module
**Purpose:** Foundational utilities and workflows

### Anytime Commands
| Code | Command | Description |
|------|---------|-------------|
| BSP | `bmad-brainstorming` | Generate diverse ideas through interactive techniques |
| PM | `bmad-party-mode` | Orchestrate multi-agent discussions |
| BH | `bmad-help` | Get unstuck by showing what workflow steps come next |
| ID | `bmad-index-docs` | Create lightweight index for quick LLM scanning |
| SD | `bmad-shard-doc` | Split large documents into smaller files by sections |
| EP | `bmad-editorial-review-prose` | Review prose for clarity, tone, and communication issues |
| ES | `bmad-editorial-review-structure` | Propose cuts, reorganization, and simplification |
| AR | `bmad-review-adversarial-general` | Review content critically to find issues and weaknesses |
| ECH | `bmad-review-edge-case-hunter` | Walk every branching path and boundary condition in code |

---

## 🧪 TEA Module (Test Engineering & Automation)
**Purpose:** Advanced test architecture and quality assurance

### Phase 0: Learning
| Code | Command | Description |
|------|---------|-------------|
| TMT | `bmad-tea-teach-me-testing` | Teach testing fundamentals through 7 sessions (TEA Academy) |

### Phase 3: Solutioning
| Code | Command | Description |
|------|---------|-------------|
| TD | `bmad-tea-testarch-test-design` | Risk-based test planning |
| TF | `bmad-tea-testarch-framework` | Initialize production-ready test framework |
| CI | `bmad-tea-testarch-ci` | Configure CI/CD quality pipeline |

### Phase 4: Implementation
| Code | Command | Description |
|------|---------|-------------|
| AT | `bmad-tea-testarch-atdd` | Generate failing tests (TDD red phase) |
| TA | `bmad-tea-testarch-automate` | Expand test coverage |
| RV | `bmad-tea-testarch-test-review` | Quality audit with 0-100 scoring |
| NR | `bmad-tea-testarch-nfr` | Non-functional requirements assessment |
| TR | `bmad-tea-testarch-trace` | Coverage traceability and gate |

---

## 🎭 Available Agents

| Agent | Name | Role | Module |
|-------|------|------|--------|
| 🧙 bmad-master | BMad Master | Master Task Executor & Workflow Orchestrator | core |
| 📊 analyst | Mary | Business Analyst | bmm |
| 🏗️ architect | Winston | Architect | bmm |
| 💻 dev | Amelia | Developer Agent | bmm |
| 📋 pm | John | Product Manager | bmm |
| 🧪 qa | Quinn | QA Engineer | bmm |
| 🚀 quick-flow-solo-dev | Barry | Quick Flow Solo Dev | bmm |
| 🏃 sm | Bob | Scrum Master | bmm |
| 📚 tech-writer | Paige | Technical Writer | bmm |
| 🎨 ux-designer | Sally | UX Designer | bmm |
| 🤖 agent-builder | Bond | Agent Building Expert | bmb |
| 🏗️ module-builder | Morgan | Module Creation Master | bmb |
| 🔄 workflow-builder | Wendy | Workflow Building Master | bmb |
| 🧪 tea | Murat | Master Test Architect | tea |

---

## 📋 Quick Reference: Development Flow

### Standard BMAD Method Flow
1. **Analysis** → BP/CB → MR/DR/TR
2. **Planning** → CP → VP → CU
3. **Solutioning** → CA → CE → IR
4. **Implementation** → SP → (CS → VS → DS → CR) × stories → ER

### Quick Flow (for simple tasks)
1. QS (Quick Spec)
2. QD (Quick Dev)

### Brownfield Projects
1. DP (Document Project)
2. GPC (Generate Project Context)
3. Then follow standard or quick flow

---

## 📝 Legend
- ✅ = Required step in workflow
- Commands without agents are standalone tasks
- Phase numbers indicate typical workflow order
- "anytime" commands can be used at any point

---

**Generated:** 3/11/2026
**Total Commands:** 80+ across 4 modules
