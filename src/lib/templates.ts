export interface Template {
  id: string;
  title: string;
  body: string; // MDX source
}

/// Bundled local templates. Each starts with a top-level heading so the
/// serializer/parser treat it as a normal document. Action items use plain
/// bullets (the serializer supports bulletList today; task-list `- [ ]`
/// round-trip is a future addition).
export const TEMPLATES: Template[] = [
  {
    id: "blank",
    title: "Blank",
    body: "# Untitled\n\n",
  },
  {
    id: "meeting-notes",
    title: "Meeting notes",
    body: `# Meeting — {Date}

<Callout type="info">Attendees: add names here.</Callout>

## Agenda

- Topic one
- Topic two
- Topic three

## Notes

- 

## Action items

- [ ] Owner — action — due date
`,
  },
  {
    id: "blog-post",
    title: "Blog post",
    body: `# {Title}

Intro paragraph that hooks the reader.

## The point

First argument.

## Why it matters

<Quote>A pull quote that frames the takeaway.</Quote>

## Wrapping up

Closing thought.
`,
  },
  {
    id: "weekly-review",
    title: "Weekly review",
    body: `# Week of {Date}

<StatGroup stats="[{&quot;label&quot;:&quot;Wins&quot;,&quot;value&quot;:&quot;3&quot;},{&quot;label&quot;:&quot;Learned&quot;,&quot;value&quot;:&quot;5&quot;}]" />

## Wins

- 

## Learned

- 

## Next week

- 
`,
  },
  {
    id: "readme",
    title: "README / project doc",
    body: `# {Project}

One-line description.

## Overview

What this is and why.

## Install

\`\`\`bash
# install steps
\`\`\`

## Usage

\`\`\`bash
# example command
\`\`\`
`,
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
