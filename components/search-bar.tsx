'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Globe, User, Quote } from 'lucide-react';
import { detectInputType } from '@/lib/query-utils';
import { toast } from 'sonner';

interface SearchBarProps {
  caseId: string;
  onQueryCreated: (newQueryId?: string, rawInput?: string, query?: { id: string; case_id: string; raw_input: string; normalized_input: string; input_type: 'url' | 'username' | 'quote'; status: string; created_at: string }) => void;
}

export function SearchBar({ caseId, onQueryCreated }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'url' | 'username' | 'quote'>('quote');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (input.trim()) {
      setInputType(detectInputType(input));
    }
  }, [input]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          rawInput: input.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create query');
      }
      const newQueryId = data.queryId ?? data.query?.id ?? undefined;
      const rawInputValue = input.trim();
      const fullQuery = data.query ?? undefined;
      toast.success('Query created successfully');
      setInput('');
      onQueryCreated(newQueryId, rawInputValue, fullQuery);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create query');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = () => {
    switch (inputType) {
      case 'url':
        return <Globe className="h-4 w-4" />;
      case 'username':
        return <User className="h-4 w-4" />;
      default:
        return <Quote className="h-4 w-4" />;
    }
  };

  const getTypeLabel = () => {
    switch (inputType) {
      case 'url':
        return 'URL';
      case 'username':
        return 'Username';
      default:
        return 'Quote';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 lg:h-5 lg:w-5 text-emerald-600" />
          <Input
            type="text"
            placeholder="Enter URL, username, or search term..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-9 lg:pl-10 bg-white border-emerald-200 text-gray-900 placeholder:text-gray-400 h-10 text-sm font-mono focus:border-emerald-500 lg:h-12 lg:text-base"
            disabled={loading}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto px-3 sm:px-6 lg:px-8 h-10 text-sm font-mono lg:h-12 lg:text-base"
        >
          {loading ? 'RUNNING...' : 'EXECUTE'}
        </Button>
      </div>
      {input.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-emerald-700 font-mono">TYPE.DETECTED:</span>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
            {getIcon()}
            <span className="ml-1">{getTypeLabel()}</span>
          </Badge>
        </div>
      )}
    </form>
  );
}
