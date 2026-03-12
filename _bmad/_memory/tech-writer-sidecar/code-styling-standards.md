# Code Styling Standards for BMAD

Mandatory code styling expectations for all generated code, implementations, and code examples.

---

## User Specified CRITICAL Rules - Supersedes General CRITICAL RULES

None

---

## General CRITICAL RULES

### Rule 1: Language Consistency Within Files

A single file MUST use ONE language consistently. NEVER mix syntaxes, conventions, or paradigms from different languages within the same file.

### Rule 2: No Time Estimates

NEVER provide time estimates for implementation tasks, coding activities, or completion timelines. Focus on requirements, approach, and outcomes.

### Rule 3: Complete Working Code

ALL code examples and generated code MUST be complete, functional, and syntactically correct. No pseudo-code, no placeholder comments like "// TODO", no incomplete implementations.

---

## General Styling Principles

### Language-Specific Conventions

**TypeScript/JavaScript:**

- Use `const` by default, `let` when mutation is required, never `var`
- Use camelCase for variables and functions
- Use PascalCase for classes, components, interfaces, and types
- Use SCREAMING_SNAKE_CASE for constants
- Prefer arrow functions for callbacks and anonymous functions
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safety
- Always define explicit return types for functions

**Rust:**

- Use snake_case for variables, functions, and modules
- Use PascalCase for structs, enums, and traits
- Use SCREAMING_SNAKE_CASE for constants
- Prefer `let` with pattern matching over mutable variables
- Use `&str` for string slices, `String` for owned strings
- Always handle `Result` and `Option` types explicitly

**Python:**

- Use snake_case for variables, functions, and methods
- Use PascalCase for classes
- Use SCREAMING_SNAKE_CASE for constants
- Use type hints for all function signatures
- Prefer f-strings for string formatting

**CSS/SCSS:**

- Use BEM (Block Element Modifier) naming convention
- Nest selectors thoughtfully (max 3 levels deep)
- Use CSS custom properties (variables) for theming
- Group related properties together
- Use meaningful class names that describe purpose, not appearance

---

## Formatting Rules

### Indentation and Spacing

- Use **2 spaces** for indentation (no tabs)
- Use **1 blank line** between top-level definitions
- Use **no blank lines** within function bodies (except to separate logical groups)
- Use **1 space** before opening braces `{`
- Use **1 space** after control flow keywords (`if`, `for`, `while`, `switch`)
- Use **no spaces** inside parentheses `(arg)` except where required for readability
- Use **1 space** around operators (`a + b`, `x === y`)

### Line Length

- Maximum line length: **100 characters**
- Break long lines at logical points (after commas, before operators)
- Indent continuation lines by 2 spaces

### Code Block Requirements

**ALL code blocks MUST include:**

1. Language identifier for syntax highlighting
2. Working, complete code (no placeholders)
3. Meaningful variable/function names
4. Comments only when they add value (not redundant)

**Example - CORRECT:**

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

function createUser(data: Omit<User, 'id' | 'createdAt'>): User {
  return {
    ...data,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
}
```

---

## Naming Conventions

### General Principles

- Use **descriptive, intent-revealing names**
- Names should answer: "What does this contain/do?"
- Avoid single-letter names except:
  - Loop counters (`i`, `j`, `k`)
  - Mathematical coordinates (`x`, `y`, `z`)
  - Arrow function parameters in callbacks

### Naming Anti-Patterns (NEVER USE)

- Hungarian notation (`strName`, `iCount`)
- Underscore prefixes except for private class fields
- Abbreviations that aren't widely understood
- Single letter names for anything except loop counters
- Numbers in names (`item1`, `item2` - use arrays instead)

---

## Error Handling

### Requirements

- Always handle errors explicitly and appropriately
- Use language-appropriate error types
- Provide meaningful error messages
- Never silently swallow errors
- Log errors with appropriate context

**Example - TypeScript:**

```typescript
async function fetchUser(id: string): Promise<User> {
  try {
    const response = await api.get(`/users/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    return response.data;
  } catch (error) {
    logger.error('fetchUser failed', { userId: id, error });
    throw error; // Re-throw with context added
  }
}
```

---

## Type Safety

### Requirements

- **ALWAYS** use explicit types for function parameters and return values
- **ALWAYS** use explicit types for public class properties
- Use `unknown` instead of `any` when type is truly unknown
- Prefer strict null checking
- Use discriminated unions for type-safe state management

---

## Documentation Within Code

### When to Comment

- **DO:** Explain WHY (business logic, complex algorithms, non-obvious decisions)
- **DO:** Document complex regular expressions
- **DO:** Note external dependencies or API quirks
- **DO:** Explain workarounds for bugs or limitations

- **DON'T:** Explain obvious code (e.g., `i++ // increment i`)
- **DON'T:** Leave TODO comments - implement or create an issue
- **DON'T:** Comment out code - delete it (use version control)

---

## Component Design Principles

### Dumb Components / Logic Extraction

Components should be relatively "dumb" and focused on rendering UI. Heavy logic, data transformations, and side effects should be extracted to:

- **Custom Hooks** - For stateful logic and side effects
- **Utility Functions/Libraries** - For pure data transformations
- **Service Methods** - For external API calls and complex operations

**Example - CORRECT (Logic extracted to hooks/utils):**

```typescript
// Component is dumb - just renders UI
function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading, error } = useUser(userId);
  
  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return (
    <div className="user-profile">
      <Avatar src={user.avatarUrl} />
      <Name>{user.name}</Name>
      <Email>{user.email}</Email>
    </div>
  );
}
```

```typescript
// Hook handles all the heavy lifting
function useUser(userId: string) {
  const [state, setState] = useState<UserState>(initialState);
  
  useEffect(() => {
    fetchUser(userId)
      .then(setState)
      .catch(handleError);
  }, [userId]);
  
  return state;
}
```

**Example - INCORRECT (Logic in component):**

```typescript
// DON'T - Component doing too much
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/users/${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(transformUserData(data)); // Transformation in component
        setIsLoading(false);
      })
      .catch(err => {
        setError(err);
        setIsLoading(false);
      });
  }, [userId]);
  
  // Validation logic in component
  const validateUser = (user: User) => {
    return user.name.length > 0 && user.email.includes('@');
  };
  
  // Formatting in component
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString();
  };
  
  if (isLoading) return <Spinner />;
  // ... rest of component
}
```

---

### Component Size Limits

When a component exceeds **150 lines**, it should be broken into smaller, focused sub-components.

**Indicators that a component is too large:**
- Multiple render paths (conditional rendering)
- Multiple useEffect hooks
- More than 3-4 props
- Nested loops in JSX
- Multiple sections with clear separation concerns

**Breaking Down Large Components:**

```typescript
// Parent component (composes children)
function OrderPage({ orderId }: { orderId: string }) {
  return (
    <PageContainer>
      <OrderHeader orderId={orderId} />
      <OrderItems orderId={orderId} />
      <OrderSummary orderId={orderId} />
      <OrderActions orderId={orderId} />
    </PageContainer>
  );
}

// Sub-components each handle one concern
function OrderHeader({ orderId }: { orderId: string }) { /* ... */ }
function OrderItems({ orderId }: { orderId: string }) { /* ... */ }
function OrderSummary({ orderId }: { orderId: string }) { /* ... */ }
function OrderActions({ orderId }: { orderId: string }) { /* ... */ }
```

---

### Single Responsibility Principle (SRP) for Interfaces and Helpers

Large interfaces, types, and helper functions should NOT live directly in component files. Instead, they should be extracted to their own files following SRP.

**Folder Structure for Complex Components:**

```
components/
└── UserProfile/
    ├── UserProfile.tsx        # Main component (imports from children)
    ├── UserProfile.types.ts   # Interface definitions
    ├── UserProfile.utils.ts   # Pure helper functions
    ├── UserProfile.hooks.ts  # Custom hooks specific to this component
    ├── UserProfile.styles.ts # Styles (if not using CSS modules)
    ├── components/           # Sub-components
    │   ├── Avatar.tsx
    │   ├── Name.tsx
    │   └── Email.tsx
    └── index.ts              # Barrel export
```

**Example - Separate Types File:**

```typescript
// UserProfile.types.ts
export interface UserProfileProps {
  userId: string;
  showActions?: boolean;
  className?: string;
}

export interface UserData {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  createdAt: Date;
}

export interface UserState {
  user: UserData | null;
  isLoading: boolean;
  error: Error | null;
}
```

**Example - Separate Utils File:**

```typescript
// UserProfile.utils.ts
export function formatUserName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function transformUserData(raw: RawUserData): UserData {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
  };
}
```

**Example - Separate Hooks File:**

```typescript
// UserProfile.hooks.ts
export function useUserProfile(userId: string) {
  const [state, setState] = useState<UserState>(initialState);
  
  useEffect(() => {
    // Fetch logic here
  }, [userId]);
  
  return state;
}

export function useUserActions(userId: string) {
  const { mutate: updateUser } = useMutation(updateUserApi);
  
  return {
    onEdit: () => { /* ... */ },
    onDelete: () => { /* ... */ },
    onExport: () => { /* ... */ },
  };
}
```

**Example - Barrel Export:**

```typescript
// UserProfile/index.ts
export { UserProfile } from './UserProfile';
export type { UserProfileProps, UserData, UserState } from './UserProfile.types';
export * from './UserProfile.utils';
export * from './UserProfile.hooks';
export { Avatar } from './components/Avatar';
export { Name } from './components/Name';
export { Email } from './components/Email';
```

---

## File Organization

### Structure Requirements

1. **Imports/Dependencies** - first, grouped by origin (external, internal, local)
2. **Type definitions** - interfaces, types, enums
3. **Constants** - configuration values, magic numbers extracted
4. **Main logic** - functions, classes, components
5. **Exports** - if applicable

### File Naming

- Use **kebab-case** for file names: `user-service.ts`, `api-client.ts`
- Use **PascalCase** for component files: `UserProfile.tsx`, `Header.vue`
- Use **snake_case** for config files: `babel.config.js`, `webpack.config.js`

---

## Quality Checklist

Before finalizing ANY code:

- [ ] Language consistent throughout file
- [ ] No placeholder code or TODOs
- [ ] Indentation is 2 spaces
- [ ] Line length under 100 characters
- [ ] All functions have explicit return types
- [ ] Variables have explicit types or clear inference
- [ ] Error handling is explicit and meaningful
- [ ] Naming is descriptive and follows conventions
- [ ] No commented-out code
- [ ] Comments explain WHY, not WHAT
- [ ] Code blocks have language identifiers
- [ ] Imports are properly organized
