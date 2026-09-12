import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Child } from '@littlefootprints/shared';
import { GrowthPage } from './GrowthPage';

const { mockedUseChildren, mockedUsePerspective, mockedUseGrowthEvents, mockedUseChildSummaries, mockedUseInterests, mockedUseJournal, mockedUseHealthRecords } = vi.hoisted(() => ({
  mockedUseChildren: vi.fn(),
  mockedUsePerspective: vi.fn(),
  mockedUseGrowthEvents: vi.fn(),
  mockedUseChildSummaries: vi.fn(),
  mockedUseInterests: vi.fn(),
  mockedUseJournal: vi.fn(),
  mockedUseHealthRecords: vi.fn(),
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
    useJournal: mockedUseJournal,
    useHealthProfile: () => ({ data: { childId: 'child-1', allergies: '尘螨', chronicConditions: '哮喘', notes: null, createdAt: '', updatedAt: '' } }),
    useHealthRecords: mockedUseHealthRecords,
    useCreateHealthRecord: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useUpdateHealthRecord: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useDeleteHealthRecord: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUploadHealthAsset: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useVaccines: () => ({ data: [
      { id: 'v1', childId: 'child-1', name: '乙肝疫苗', dose: '第1剂', scheduledDate: '2024-06-15', administeredDate: '2024-06-16', note: null, createdAt: '', updatedAt: '' },
      { id: 'v2', childId: 'child-1', name: '流感疫苗', dose: '第1剂', scheduledDate: '2026-01-01', administeredDate: null, note: null, createdAt: '', updatedAt: '' },
    ], isLoading: false }),
    useCreateVaccine: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUpdateVaccine: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useAdministerVaccine: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useDeleteVaccine: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useGenerateVaccineTemplate: () => ({ mutate: vi.fn(), isPending: false }),
    useProfile: () => ({ data: { childId: 'child-1', birthDate: '2024-06-15', schoolStage: null, personality: null, aiBackground: null, createdAt: '', updatedAt: '' } }),
    useCreateJournal: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useUpdateJournal: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useDeleteJournal: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUploadJournalAsset: () => ({ mutateAsync: vi.fn(), isPending: false, isError: false }),
    useMeasurements: () => ({ data: [] }),
    useCreateGrowthEvent: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useUpdateGrowthEvent: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
    useDeleteGrowthEvent: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  };
});

vi.mock('../hooks/useIntegration', () => ({
  useKidStudyStatus: () => ({ data: { configured: true, baseUrl: 'http://192.168.3.102:3001' } }),
  useLearningSummary: () => ({
    data: {
      available: true,
      summary: {
        weekStart: '2026-09-07', scheduledCount: 4, completedCount: 3, incompleteCount: 1,
        completionRate: 67, learningMinutes: 120, flowerEarned: 6, flowerDeducted: 1, flowerNet: 5,
        courses: [{ name: 'kissABC', flowerEarned: 4 }],
      },
    },
  }),
}));

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
    mockedUseJournal.mockReturnValue({ data: [], isLoading: false });
    mockedUseHealthRecords.mockReturnValue({ data: [], isLoading: false });
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

  it('renders note asset thumbnails and opens the viewer', async () => {
    mockedUseInterests.mockReturnValue({
      data: [
        {
          id: 'interest-1', childId: child.id, name: '画画', category: 'art', status: 'active',
          startedAt: '2026-01-05', endedAt: null, description: null, createdAt: '', updatedAt: '',
          notes: [
            {
              id: 'note-1', interestId: 'interest-1', date: new Date().toISOString().slice(0, 10), type: 'work',
              content: '画了海底世界', authorRole: 'child',
              assets: [
                { id: 'asset-1', kind: 'image', fileName: '海底世界.jpg', sizeBytes: 1024, thumbnailUnavailable: false },
                { id: 'asset-2', kind: 'video', fileName: '讲解.mp4', sizeBytes: 2048, thumbnailUnavailable: true },
              ],
              createdAt: '', updatedAt: '',
            },
          ],
        },
      ],
      isLoading: false,
    });
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '兴趣' }));
    const imageThumb = await screen.findByAltText('海底世界.jpg');
    expect(imageThumb).toBeInTheDocument();
    expect(screen.getAllByText('🎬').length).toBeGreaterThanOrEqual(1);
    await user.click(imageThumb);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/讲解\.mp4|1 \/ 2/)).toBeInTheDocument();
  });

  it('shows the daily journal section with entries grouped and mood', async () => {
    mockedUseJournal.mockReturnValue({
      data: [
        {
          id: 'j1', childId: child.id, date: '2026-09-07', content: '我学会跳绳了！',
          mood: 'great', authorRole: 'child', assets: [], createdAt: '', updatedAt: '',
        },
      ],
      isLoading: false,
    });
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '日志' }));
    expect(await screen.findByText('我学会跳绳了！')).toBeInTheDocument();
    expect(screen.getByText('特别开心 😄')).toBeInTheDocument();
  });

  it('shows the learning overview card from the kid-study bridge', async () => {
    renderPage();
    expect(await screen.findByText('📚 本周学习')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('2时0分')).toBeInTheDocument();
    expect(screen.getByText('kissABC +4')).toBeInTheDocument();
  });

  it('shows the vaccine section with due and done groups', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '健康' }));
    expect(await screen.findByText('疫苗接种')).toBeInTheDocument();
    expect(screen.getByText(/已到期待种/)).toBeInTheDocument();
    expect(screen.getByText(/乙肝疫苗 · 第1剂/)).toBeInTheDocument();
  });

  it('shows the health section with profile card and records', async () => {
    mockedUseHealthRecords.mockReturnValue({
      data: [
        {
          id: 'hr1', childId: child.id, date: '2026-09-10', type: 'illness', title: '哮喘复诊',
          facility: '市儿童医院', summary: '调整吸入剂剂量。', followUpDate: '2026-09-24',
          assets: [], createdAt: '', updatedAt: '',
        },
      ],
      isLoading: false,
    });
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: '健康' }));
    expect(await screen.findByText('哮喘复诊')).toBeInTheDocument();
    expect(screen.getByText('哮喘')).toBeInTheDocument(); // profile card
    expect(screen.getByText(/复查 2026-09-24/)).toBeInTheDocument();
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
