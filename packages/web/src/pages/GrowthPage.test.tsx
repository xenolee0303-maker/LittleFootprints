import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Child } from '@bloommate/shared';
import { GrowthPage } from './GrowthPage';

const { mockedUseChildren, mockedUsePerspective, mockedUseGrowthEvents, mockedUseChildSummaries, mockedUseInterests } = vi.hoisted(() => ({
  mockedUseChildren: vi.fn(),
  mockedUsePerspective: vi.fn(),
  mockedUseGrowthEvents: vi.fn(),
  mockedUseChildSummaries: vi.fn(),
  mockedUseInterests: vi.fn(),
}));

vi.mock('../hooks/useChildren', () => ({
  useChildren: mockedUseChildren,
}));

vi.mock('../lib/perspective', () => ({
  usePerspective: mockedUsePerspective,
}));

vi.mock('../hooks/useGrowth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useGrowth')>();
  return {
    ...actual,
    useGrowthEvents: mockedUseGrowthEvents,
    useChildSummaries: mockedUseChildSummaries,
    useInterests: mockedUseInterests,
    useProfile: () => ({ data: undefined }),
    useMeasurements: () => ({ data: [] }),
    useCreateGrowthEvent: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUpdateGrowthEvent: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useDeleteGrowthEvent: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  };
});

vi.mock('../components/ai/AiQuestionPanel', () => ({
  AiQuestionPanel: () => <div data-testid="ai-panel" />,
}));

vi.mock('../hooks/useMedia', () => ({
  useMediaStatus: () => ({ data: { configured: true, directoryCount: 2 } }),
  useMediaDirectories: () => ({ data: [], isLoading: false }),
  useMediaItems: () => ({
    data: [
      { name: 'a.jpg', kind: 'image', path: '2026-08-北京旅游/a.jpg', sizeBytes: 1, modifiedAt: '2026-08-01T00:00:00Z', thumbnailUnavailable: false },
      { name: 'v.mp4', kind: 'video', path: '2026-08-北京旅游/v.mp4', sizeBytes: 2, modifiedAt: '2026-08-02T00:00:00Z', thumbnailUnavailable: true },
    ],
  }),
  mediaThumbUrl: (path: string) => `/api/media/thumb?path=${path}`,
  mediaOriginalUrl: (path: string) => `/api/media/original?path=${path}`,
}));

const child: Child = { id: 'child-1', name: '小明', createdAt: '', updatedAt: '' };

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GrowthPage />
    </QueryClientProvider>,
  );
}

describe('GrowthPage', () => {
  beforeEach(() => {
    mockedUseChildren.mockReturnValue({ data: [child] });
    mockedUsePerspective.mockReturnValue({
      perspective: { mode: 'parent' },
      isParent: true,
      perspectiveChildId: undefined,
      authorRole: 'parent',
    });
    mockedUseGrowthEvents.mockReturnValue({ data: [], isLoading: false });
    mockedUseChildSummaries.mockReturnValue({ data: { summaries: [] } });
    mockedUseInterests.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders timeline section with add button in parent perspective', async () => {
    renderPage();
    expect(await screen.findByText('成长时间线')).toBeInTheDocument();
    expect(screen.getByText('+ 添加事件')).toBeInTheDocument();
    expect(screen.getByText('小明')).toBeInTheDocument(); // child pill
  });

  it('hides parent-only controls in child perspective', async () => {
    mockedUsePerspective.mockReturnValue({
      perspective: { mode: 'child', childId: 'child-1' },
      isParent: false,
      perspectiveChildId: 'child-1',
      authorRole: 'child',
    });
    renderPage();
    expect(await screen.findByText('小明的成长')).toBeInTheDocument();
    expect(screen.queryByText('+ 添加事件')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-panel')).not.toBeInTheDocument();
  });

  it('shows photo strip for events with a bound media directory and opens the gallery', async () => {
    mockedUseGrowthEvents.mockReturnValue({
      data: [
        {
          id: 'event-1', type: 'travel', title: '北京旅游', startDate: '2026-08-01', endDate: '2026-08-05',
          location: '北京', description: null, participantChildIds: [child.id], authorRole: 'parent',
          mediaDirectory: '2026-08-北京旅游', createdAt: '', updatedAt: '',
        },
      ],
      isLoading: false,
    });
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage();
    const strip = await screen.findByRole('button', { name: '查看 2 张照片' });
    await user.click(strip);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('2026-08-北京旅游 · 2 项')).toBeInTheDocument();
  });

  it('renders the child weekly summary highlight card with history', async () => {
    mockedUseChildSummaries.mockReturnValue({
      data: {
        summaries: [
          { weekStart: '2026-09-07', childSummary: { title: '坚持练琴的一周', text: '你主动练习了三次，越来越熟练了。', goal: '每天练 15 分钟' }, generatedAt: null },
          { weekStart: '2026-08-31', childSummary: { title: '上周的亮点', text: '上周也很棒。', goal: '' }, generatedAt: null },
        ],
      },
    });
    renderPage();
    expect(await screen.findByText('坚持练琴的一周')).toBeInTheDocument();
    expect(screen.getByText(/每天练 15 分钟/)).toBeInTheDocument();
    expect(screen.getByText('查看往期（1 周）')).toBeInTheDocument();
  });

  it('shows weekly note stats on interest cards', async () => {
    const dateOffset = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    mockedUseInterests.mockReturnValue({
      data: [
        {
          id: 'interest-1', childId: child.id, name: '钢琴', category: 'art', status: 'active',
          startedAt: '2025-09-01', endedAt: null, description: null, createdAt: '', updatedAt: '',
          notes: [
            { id: 'n1', interestId: 'interest-1', date: dateOffset(0), type: 'practice', content: '今天', authorRole: 'child', createdAt: '', updatedAt: '' },
            { id: 'n2', interestId: 'interest-1', date: dateOffset(10), type: 'practice', content: '十天前', authorRole: 'parent', createdAt: '', updatedAt: '' },
          ],
        },
      ],
      isLoading: false,
    });
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '兴趣' }));
    expect(await screen.findByText('本周 1 条')).toBeInTheDocument();
    expect(screen.getByText('近4周 2 条')).toBeInTheDocument();
  });

  it('switches to interests and profile sections', async () => {
    renderPage();
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '兴趣' }));
    expect(screen.getByText('兴趣爱好')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '档案' }));
    expect(screen.getByText('成长档案')).toBeInTheDocument();
    expect(screen.getByText('AI 基础信息')).toBeInTheDocument();
  });
});
