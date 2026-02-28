'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { SidebarCases } from '@/components/sidebar-cases';
import { SearchBar } from '@/components/search-bar';
import { QueryList } from '@/components/query-list';
import { ResultsTabs } from '@/components/results-tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CaseBriefs } from '@/components/case-briefs';
import { detectInputType } from '@/lib/query-utils';
import { Menu, Loader2, Network, Pencil, Coins } from 'lucide-react';
import { toast } from 'sonner';

interface Case {
  id: string;
  title: string;
  tags: string[];
  objective?: string | null;
  created_at: string;
}

interface Query {
  id: string;
  case_id: string;
  raw_input: string;
  normalized_input: string;
  input_type: 'url' | 'username' | 'quote';
  status: 'running' | 'complete';
  created_at: string;
}

interface CaseEntity {
  id: string;
  name: string;
  entity_type: string;
  mention_count: number;
}

interface EntityMention {
  id: string;
  evidence_kind: string;
  evidence_id: string;
  query_id: string | null;
  context_snippet: string | null;
  created_at: string;
}

interface CaseTask {
  id: string;
  title: string;
  detail: string | null;
  priority: string;
  status: string;
  created_at: string;
}

export default function CasePage() {
  const params = useParams();
  const caseId = params.caseId as string;

  const [cases, setCases] = useState<Case[]>([]);
  const [currentCase, setCurrentCase] = useState<Case | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [selectedQueryId, setSelectedQueryId] = useState<string | undefined>();
  const [entities, setEntities] = useState<CaseEntity[]>([]);
  const [entitiesLoading, setEntitiesLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [mentionsSheetOpen, setMentionsSheetOpen] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState<CaseEntity | null>(null);
  const [mentions, setMentions] = useState<EntityMention[]>([]);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [tasks, setTasks] = useState<CaseTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState<'open' | 'done'>('open');
  const [editCaseOpen, setEditCaseOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editObjective, setEditObjective] = useState('');
  const [savingCase, setSavingCase] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usage, setUsage] = useState<{ prompt_tokens: number; completion_tokens: number; total_tokens: number } | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [addQueryOpen, setAddQueryOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addCategory, setAddCategory] = useState<'url' | 'username' | 'quote'>('quote');
  const [addQuerySaving, setAddQuerySaving] = useState(false);
  const [editQueryOpen, setEditQueryOpen] = useState(false);
  const [editQuery, setEditQuery] = useState<Query | null>(null);
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategory, setEditCategory] = useState<'url' | 'username' | 'quote'>('quote');
  const [editQuerySaving, setEditQuerySaving] = useState(false);

  const fetchQueries = useCallback(async () => {
    try {
      const response = await fetch(`/api/queries?caseId=${caseId}`);
      const text = await response.text();
      let data: { queries?: Query[]; error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { error: response.ok ? 'Invalid response' : text || response.statusText };
      }
      if (response.ok) {
        const list = data.queries || [];
        setQueries((prev) => {
          if (list.length === 0 && prev.length > 0) {
            return prev;
          }
          return list;
        });
        setSelectedQueryId((prev) => {
          if (list.length > 0 && !prev) return list[0].id;
          if (list.length > 0 && prev && !list.some((q: Query) => q.id === prev)) return list[0].id;
          return prev;
        });
        if (process.env.NODE_ENV === 'development' && list.length === 0) {
          console.warn('[CasePage] Queries fetch returned 0 for caseId=', caseId);
        }
      } else {
        console.error('Failed to fetch queries:', data?.error || response.statusText);
        setQueries((prev) =>
          prev.some((q) => q.status === 'running')
            ? prev.map((q) => (q.status === 'running' ? { ...q, status: 'complete' as const } : q))
            : prev
        );
      }
    } catch (error) {
      console.error('Failed to fetch queries:', error);
      setQueries((prev) =>
        prev.some((q) => q.status === 'running')
          ? prev.map((q) => (q.status === 'running' ? { ...q, status: 'complete' as const } : q))
          : prev
      );
    }
  }, [caseId]);

  const fetchCases = useCallback(async () => {
    try {
      const response = await fetch('/api/cases');
      if (response.ok) {
        const data = await response.json();
        setCases(data.cases || []);
        const current = data.cases.find((c: Case) => c.id === caseId);
        setCurrentCase(current || null);
      }
    } catch (error) {
      console.error('Failed to fetch cases:', error);
    }
  }, [caseId]);

  const fetchEntities = useCallback(async () => {
    if (!caseId) return;
    setEntitiesLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/entities`);
      const data = await res.json();
      if (res.ok) setEntities(data.entities ?? []);
    } catch {
      setEntities([]);
    } finally {
      setEntitiesLoading(false);
    }
  }, [caseId]);

  const fetchTasks = useCallback(async () => {
    if (!caseId) return;
    setTasksLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/tasks`);
      const data = await res.json();
      if (res.ok) setTasks(data.tasks ?? []);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [caseId]);

  const openMentions = useCallback(async (entity: CaseEntity) => {
    setSelectedEntity(entity);
    setMentionsSheetOpen(true);
    setMentionsLoading(true);
    setMentions([]);
    try {
      const res = await fetch(`/api/cases/${caseId}/entities/${entity.id}/mentions`);
      const data = await res.json();
      if (res.ok) setMentions(data.mentions ?? []);
      else setMentions([]);
    } catch {
      setMentions([]);
    } finally {
      setMentionsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchCases();
    fetchQueries();
  }, [caseId, fetchQueries, fetchCases]);

  useEffect(() => {
    if (caseId) fetchEntities();
  }, [caseId, fetchEntities]);

  useEffect(() => {
    if (caseId) fetchTasks();
  }, [caseId, fetchTasks]);

  useEffect(() => {
    const hasRunningQuery = queries.some((q) => q.status === 'running');
    if (hasRunningQuery) {
      const interval = setInterval(fetchQueries, 2000);
      return () => clearInterval(interval);
    }
  }, [queries, fetchQueries]);

  const selectedQuery = queries.find((q) => q.id === selectedQueryId);

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden lg:block">
        <SidebarCases cases={cases} onCaseCreated={fetchCases} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto bg-gradient-to-b from-emerald-50 to-white">
          <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-5 lg:p-6 space-y-4 sm:space-y-5 lg:space-y-6">
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-100 font-mono"
                  >
                    <Menu className="h-4 w-4 mr-2" />
                    MENU
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[85vw] max-w-[20rem]">
                  <SidebarCases cases={cases} onCaseCreated={fetchCases} />
                </SheetContent>
              </Sheet>
            </div>

            <Card className="bg-white border-emerald-200 shadow-sm">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-emerald-700 text-lg font-mono lg:text-2xl">
                    {currentCase?.title || 'LOADING...'}
                  </CardTitle>
                  {currentCase && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-gray-500 hover:text-emerald-700 font-mono text-xs"
                          onClick={() => {
                            setEditTitle(currentCase.title);
                            setEditObjective(currentCase.objective ?? '');
                            setEditCaseOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          Edit case
                        </Button>
                      </div>
                      <Popover open={usageOpen} onOpenChange={(open) => {
                        setUsageOpen(open);
                        if (open) {
                          setUsageLoading(true);
                          fetch('/api/usage', { credentials: 'include' })
                            .then(async (res) => {
                              const data = await res.json();
                              if (res.ok && data.total_tokens !== undefined) {
                                setUsage({
                                  prompt_tokens: data.prompt_tokens ?? 0,
                                  completion_tokens: data.completion_tokens ?? 0,
                                  total_tokens: data.total_tokens ?? 0,
                                });
                              }
                            })
                            .catch(() => { /* keep previous usage or leave null */ })
                            .finally(() => setUsageLoading(false));
                        }
                      }}>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-gray-500 hover:text-emerald-700 font-mono text-xs"
                          >
                            <Coins className="h-3.5 w-3.5 mr-1" />
                            Tokens
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 border-emerald-200 bg-white font-mono text-sm" align="end">
                          {usageLoading ? (
                            <p className="text-gray-500">Loading...</p>
                          ) : usage ? (
                            <div className="space-y-1.5">
                              <p className="text-emerald-700 font-semibold">API token usage</p>
                              <p className="text-gray-700">Total: <span className="font-medium">{usage.total_tokens.toLocaleString()}</span></p>
                              <p className="text-gray-500 text-xs">Prompt: {usage.prompt_tokens.toLocaleString()} · Completion: {usage.completion_tokens.toLocaleString()}</p>
                            </div>
                          ) : (
                            <p className="text-gray-500">No usage yet.</p>
                          )}
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
                <CardDescription className="text-gray-600 font-mono text-xs lg:text-sm">
                  {currentCase && `CREATED: ${new Date(currentCase.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }).toUpperCase()}`}
                </CardDescription>
                {currentCase?.objective && (
                  <p className="text-emerald-800/90 font-mono text-xs lg:text-sm mt-1 pt-1 border-t border-emerald-100">
                    <span className="text-emerald-600 font-medium">OBJECTIVE: </span>
                    {currentCase.objective}
                  </p>
                )}
              </CardHeader>
              <Dialog open={editCaseOpen} onOpenChange={setEditCaseOpen}>
                <DialogContent className="bg-white border-emerald-200 max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-emerald-700 font-mono">Edit case</DialogTitle>
                    <DialogDescription className="text-gray-600 font-mono text-sm">
                      Update title and objective. Brief generation orients toward the objective when set.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 text-amber-800 text-xs font-mono mt-2">
                    Editing this case or objective after your investigation has started can throw off your course. You are advised not to change them unless necessary.
                  </div>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-case-title" className="text-emerald-700 font-mono text-sm">Title</Label>
                      <Input
                        id="edit-case-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="border-emerald-200 font-mono"
                        disabled={savingCase}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-case-objective" className="text-emerald-700 font-mono text-sm">Objective (optional)</Label>
                      <Input
                        id="edit-case-objective"
                        placeholder="What are you trying to find out or decide?"
                        value={editObjective}
                        onChange={(e) => setEditObjective(e.target.value)}
                        className="border-emerald-200 font-mono text-sm"
                        disabled={savingCase}
                      />
                    </div>
                    <Button
                      type="button"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
                      disabled={savingCase || !editTitle.trim()}
                      onClick={async () => {
                        setSavingCase(true);
                        try {
                          const res = await fetch(`/api/cases/${caseId}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: editTitle.trim(),
                              objective: editObjective.trim() || null,
                            }),
                          });
                          if (!res.ok) {
                            const data = await res.json();
                            throw new Error(data.error || 'Failed to update');
                          }
                          toast.success('Case updated');
                          setEditCaseOpen(false);
                          fetchCases();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Failed to update');
                        } finally {
                          setSavingCase(false);
                        }
                      }}
                    >
                      {savingCase ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <CardContent className="space-y-4">
                <CaseBriefs
                  caseId={caseId ?? ''}
                  caseObjective={currentCase?.objective ?? undefined}
                  onTasksImported={fetchTasks}
                  entities={entities}
                  onOpenEntityMentions={openMentions}
                  tasks={tasks}
                  fetchTasks={fetchTasks}
                />
                <SearchBar
                  caseId={caseId}
                  onQueryCreated={(newQueryId, rawInput, fullQuery) => {
                    if (newQueryId) {
                      const q: Query = fullQuery
                        ? { id: fullQuery.id, case_id: fullQuery.case_id, raw_input: fullQuery.raw_input, normalized_input: fullQuery.normalized_input, input_type: fullQuery.input_type, status: fullQuery.status as 'running' | 'complete', created_at: fullQuery.created_at }
                        : rawInput
                          ? { id: newQueryId, case_id: caseId, raw_input: rawInput, normalized_input: rawInput, input_type: detectInputType(rawInput), status: 'running', created_at: new Date().toISOString() }
                          : { id: newQueryId, case_id: caseId, raw_input: '', normalized_input: '', input_type: 'quote', status: 'running', created_at: new Date().toISOString() };
                      setQueries((prev) => [q, ...prev.filter((x) => x.id !== q.id)]);
                      setSelectedQueryId(newQueryId);
                    }
                    fetchQueries();
                  }}
                />
              </CardContent>
            </Card>

            <Card className="bg-white border-emerald-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-700 text-sm font-mono">NEXT MOVES</CardTitle>
                <CardDescription className="text-gray-600 font-mono text-xs">
                  Case tasks. Mark done to track progress.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-1 border-b border-gray-200 pb-2">
                  <button
                    type="button"
                    onClick={() => setTaskFilter('open')}
                    className={`font-mono text-xs px-2 py-1 rounded ${taskFilter === 'open' ? 'bg-emerald-100 text-emerald-800' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskFilter('done')}
                    className={`font-mono text-xs px-2 py-1 rounded ${taskFilter === 'done' ? 'bg-emerald-100 text-emerald-800' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    Done
                  </button>
                </div>
                {tasksLoading ? (
                  <p className="text-gray-500 font-mono text-xs flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </p>
                ) : (() => {
                  const filtered = taskFilter === 'done'
                    ? tasks.filter((t) => t.status === 'done').slice(0, 10)
                    : tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').slice(0, 10);
                  return filtered.length === 0 ? (
                    <p className="text-gray-400 font-mono text-xs">No tasks.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {filtered.map((t) => (
                        <li key={t.id} className="flex items-start gap-2 text-xs font-mono">
                          {taskFilter === 'open' && (
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              onChange={async () => {
                                const res = await fetch(`/api/cases/${caseId}/tasks/${t.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'done' }),
                                });
                                if (res.ok) fetchTasks();
                                else toast.error('Failed to update task');
                              }}
                            />
                          )}
                          <span className={`flex-1 min-w-0 ${taskFilter === 'done' ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                            {t.title}
                          </span>
                          {taskFilter === 'done' && (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/cases/${caseId}/tasks/${t.id}`, {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ status: 'open' }),
                                });
                                if (res.ok) fetchTasks();
                                else toast.error('Failed to undo');
                              }}
                              className="shrink-0 text-emerald-600 hover:underline"
                            >
                              Undo
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </CardContent>
            </Card>

            <Card className="bg-white border-emerald-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-700 text-sm font-mono flex items-center gap-2">
                  <Network className="h-4 w-4" />
                  TOP ENTITIES
                </CardTitle>
                <CardDescription className="text-gray-600 font-mono text-xs">
                  Extracted from notes, results, and saved links. Rebuild to refresh.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                  disabled={rebuildLoading}
                  onClick={async () => {
                    setRebuildLoading(true);
                    try {
                      const res = await fetch(`/api/cases/${caseId}/entities/rebuild`, { method: 'POST' });
                      const data = await res.json();
                      if (res.ok && data.ok) {
                        toast.success(`Entities: ${data.entityCount ?? 0}, mentions: ${data.mentionCount ?? 0}`);
                        fetchEntities();
                      } else {
                        toast.error(data?.error ?? 'Rebuild failed');
                      }
                    } catch {
                      toast.error('Rebuild failed');
                    } finally {
                      setRebuildLoading(false);
                    }
                  }}
                >
                  {rebuildLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Rebuild Entities
                </Button>
                {entitiesLoading ? (
                  <p className="text-gray-500 font-mono text-xs flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </p>
                ) : entities.length === 0 ? (
                  <p className="text-gray-400 font-mono text-xs">No entities. Run Rebuild after adding notes or results.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {entities.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => openMentions(e)}
                          className="text-xs font-mono px-2 py-1 rounded bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                        >
                          {e.name} <span className="text-emerald-600">({e.mention_count})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Sheet open={mentionsSheetOpen} onOpenChange={setMentionsSheetOpen}>
              <SheetContent className="w-full sm:max-w-md overflow-y-auto">
                <h3 className="font-mono text-emerald-700 font-semibold mb-2">
                  {selectedEntity ? `${selectedEntity.name} (${selectedEntity.entity_type})` : 'Mentions'}
                </h3>
                {mentionsLoading ? (
                  <p className="text-gray-500 font-mono text-xs flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Loading…
                  </p>
                ) : mentions.length === 0 ? (
                  <p className="text-gray-400 font-mono text-xs">No mentions.</p>
                ) : (
                  <ul className="space-y-2">
                    {mentions.map((m) => (
                      <li key={m.id} className="text-xs border border-gray-100 rounded p-2">
                        <span className="font-mono text-emerald-600">{m.evidence_kind}</span>
                        {m.context_snippet && (
                          <p className="text-gray-600 mt-1 line-clamp-2">{m.context_snippet}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </SheetContent>
            </Sheet>

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <Card className="bg-white border-emerald-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <CardTitle className="text-emerald-700 text-lg font-mono">QUERY.TIMELINE</CardTitle>
                        <CardDescription className="text-gray-600 font-mono text-xs">
                          {queries.length} {queries.length === 1 ? 'QUERY' : 'QUERIES'} EXECUTED
                        </CardDescription>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-mono text-xs shrink-0"
                        onClick={() => {
                          setAddName('');
                          setAddDate('');
                          setAddCategory('quote');
                          setAddQueryOpen(true);
                        }}
                      >
                        Add query
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <QueryList
                      queries={queries}
                      selectedQueryId={selectedQueryId}
                      onSelectQuery={setSelectedQueryId}
                      onQueryDeleted={fetchQueries}
                      onEditQuery={(q) => {
                        setEditQuery(q);
                        setEditName(q.raw_input);
                        const d = new Date(q.created_at);
                        const pad = (n: number) => String(n).padStart(2, '0');
                        setEditDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                        setEditCategory(q.input_type);
                        setEditQueryOpen(true);
                      }}
                    />
                  </CardContent>
                  <Dialog open={addQueryOpen} onOpenChange={setAddQueryOpen}>
                    <DialogContent className="bg-white border-emerald-200 max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-emerald-700 font-mono">Add query</DialogTitle>
                        <DialogDescription className="text-gray-600 font-mono text-sm">
                          Create a manual query. Name is the label (e.g. URL, username, or quote). Category affects how it is normalized.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="add-query-name" className="text-emerald-700 font-mono text-sm">Name</Label>
                          <Input
                            id="add-query-name"
                            placeholder="URL, @handle, or search phrase"
                            value={addName}
                            onChange={(e) => setAddName(e.target.value)}
                            className="border-emerald-200 font-mono"
                            disabled={addQuerySaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="add-query-date" className="text-emerald-700 font-mono text-sm">Date & time (optional)</Label>
                          <Input
                            id="add-query-date"
                            type="datetime-local"
                            value={addDate}
                            onChange={(e) => setAddDate(e.target.value)}
                            className="border-emerald-200 font-mono"
                            disabled={addQuerySaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-emerald-700 font-mono text-sm">Category</Label>
                          <div className="flex gap-2">
                            {(['url', 'username', 'quote'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setAddCategory(t)}
                                className={`font-mono text-xs px-3 py-1.5 rounded border ${addCategory === t ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'border-emerald-200 text-gray-600 hover:bg-gray-50'}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
                          disabled={addQuerySaving || !addName.trim()}
                          onClick={async () => {
                            setAddQuerySaving(true);
                            try {
                              const res = await fetch('/api/queries', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  caseId,
                                  raw_input: addName.trim(),
                                  input_type: addCategory,
                                  created_at: addDate.trim() ? new Date(addDate.trim()).toISOString() : undefined,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed to create query');
                              toast.success('Query added');
                              setAddQueryOpen(false);
                              await fetchQueries();
                              if (data.query?.id) setSelectedQueryId(data.query.id);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed to add query');
                            } finally {
                              setAddQuerySaving(false);
                            }
                          }}
                        >
                          {addQuerySaving ? 'Adding...' : 'Add query'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Dialog open={editQueryOpen} onOpenChange={(open) => { setEditQueryOpen(open); if (!open) setEditQuery(null); }}>
                    <DialogContent className="bg-white border-emerald-200 max-w-md">
                      <DialogHeader>
                        <DialogTitle className="text-emerald-700 font-mono">Edit query</DialogTitle>
                        <DialogDescription className="text-gray-600 font-mono text-sm">
                          Update name, date, or category.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="edit-query-name" className="text-emerald-700 font-mono text-sm">Name</Label>
                          <Input
                            id="edit-query-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="border-emerald-200 font-mono"
                            disabled={editQuerySaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-query-date" className="text-emerald-700 font-mono text-sm">Date & time</Label>
                          <Input
                            id="edit-query-date"
                            type="datetime-local"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="border-emerald-200 font-mono"
                            disabled={editQuerySaving}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-emerald-700 font-mono text-sm">Category</Label>
                          <div className="flex gap-2">
                            {(['url', 'username', 'quote'] as const).map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => setEditCategory(t)}
                                className={`font-mono text-xs px-3 py-1.5 rounded border ${editCategory === t ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'border-emerald-200 text-gray-600 hover:bg-gray-50'}`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-mono"
                          disabled={editQuerySaving || !editName.trim() || !editQuery}
                          onClick={async () => {
                            if (!editQuery) return;
                            setEditQuerySaving(true);
                            try {
                              const res = await fetch(`/api/queries?queryId=${editQuery.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  raw_input: editName.trim(),
                                  input_type: editCategory,
                                  created_at: editDate.trim() ? new Date(editDate.trim()).toISOString() : undefined,
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error || 'Failed to update query');
                              toast.success('Query updated');
                              setEditQueryOpen(false);
                              setEditQuery(null);
                              await fetchQueries();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Failed to update query');
                            } finally {
                              setEditQuerySaving(false);
                            }
                          }}
                        >
                          {editQuerySaving ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </Card>
              </div>

              <div className="lg:col-span-3">
                {selectedQuery ? (
                  <Card className="bg-white border-emerald-200 shadow-sm">
                    <CardHeader>
                      <CardTitle className="text-emerald-700 text-lg font-mono">RESULTS</CardTitle>
                      <CardDescription className="text-gray-600 truncate font-mono text-xs">
                        {selectedQuery.raw_input}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ResultsTabs
                        queryId={selectedQuery.id}
                        queryStatus={selectedQuery.status}
                        rawInput={selectedQuery.raw_input}
                        caseId={caseId}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-white border-emerald-200 shadow-sm">
                    <CardContent className="text-center py-12 text-emerald-600/50 font-mono text-sm">
                      SELECT.QUERY.TO.VIEW.RESULTS
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
