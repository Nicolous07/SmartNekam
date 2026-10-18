// template.tsx hujengwa upya kila mtumiaji anapobadilisha ukurasa,
// kwa hiyo kila ukurasa wa ndani ya app unaingia kwa animation laini.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>
}
