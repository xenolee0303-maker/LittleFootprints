import { useEffect, useState } from 'react';
import { useChildren } from '../../hooks/useChildren';
import {
  useKidStudyStatus,
  useSaveKidStudyConfig,
  useTestKidStudy,
  useKidStudyChildren,
  useChildIntegration,
  useSetChildIntegration,
  useClearChildIntegration,
} from '../../hooks/useIntegration';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

function KidStudyMapping({ childId, childName, kidstudyChildren }: {
  childId: string;
  childName: string;
  kidstudyChildren: Array<{ id: string; name: string }>;
}) {
  const { data: mapping } = useChildIntegration(childId);
  const setMapping = useSetChildIntegration(childId);
  const clearMapping = useClearChildIntegration(childId);
  const [selected, setSelected] = useState('');

  useEffect(() => {
    setSelected(mapping?.kidstudyChildId ?? '');
  }, [mapping?.kidstudyChildId]);

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-24 shrink-0 text-sm text-gray-800">{childName}</span>
      <select
        value={selected}
        onChange={(event) => {
          const chosen = kidstudyChildren.find((child) => child.id === event.target.value);
          if (chosen) {
            setMapping.mutate({ kidstudyChildId: chosen.id, kidstudyChildName: chosen.name });
          } else {
            setSelected('');
          }
        }}
        aria-label={`${childName}对应的学习系统孩子`}
        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="">不联动</option>
        {kidstudyChildren.map((child) => (
          <option key={child.id} value={child.id}>{child.name}</option>
        ))}
      </select>
      {mapping && (
        <button
          type="button"
          onClick={() => clearMapping.mutate()}
          className="shrink-0 text-xs text-gray-400 hover:text-red-500"
        >
          取消关联
        </button>
      )}
    </div>
  );
}

export function KidStudyIntegrationSettings() {
  const { data: children } = useChildren();
  const { data: status } = useKidStudyStatus();
  const save = useSaveKidStudyConfig();
  const test = useTestKidStudy();
  const configured = status?.configured ?? false;
  const { data: kidstudyChildren } = useKidStudyChildren(configured);

  const [baseUrl, setBaseUrl] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status?.baseUrl && !baseUrl) setBaseUrl(status.baseUrl);
  }, [status?.baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    setMessage(null);
    setError(null);
    save.mutate(
      { baseUrl: baseUrl.trim(), pin: pin || undefined },
      {
        onSuccess: () => {
          setMessage('已保存。PIN 加密存储，不会回显。');
          setPin('');
        },
        onError: (saveError) => setError(saveError.message),
      },
    );
  };

  const handleTest = () => {
    setMessage(null);
    setError(null);
    test.mutate(undefined, {
      onSuccess: (result) => setMessage(`连接成功，学习系统里有 ${result.children} 个孩子`),
      onError: (testError) => setError(testError.message),
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-gray-900">学习系统联动（kid-study）</h2>
        <p className="mt-1 text-sm text-gray-500">
          只读关联家里的学习系统：AI 周报将结合完成率、学习时长和小红花做联合分析。绝不修改学习系统的任何数据。
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="学习系统地址"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="http://192.168.3.102:3001"
        />
        <Input
          label={configured ? '家庭 PIN（已配置，留空保持不变）' : '学习系统的家庭 PIN'}
          type="password"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder={configured ? '••••••' : '6 位数字'}
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          loading={save.isPending}
          disabled={!baseUrl.trim()}
          onClick={handleSave}
        >
          保存
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={test.isPending}
          disabled={!configured}
          onClick={handleTest}
        >
          测试连接
        </Button>
        {configured && (
          <span className="self-center text-xs text-emerald-600">✓ 已配置 {status?.baseUrl}</span>
        )}
      </div>
      {message && <p className="text-xs text-emerald-600">{message}</p>}
      {(error || save.isError || test.isError) && (
        <p className="text-xs text-red-500">{error ?? (save.error ?? test.error)?.message ?? '操作失败'}</p>
      )}

      {configured && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-sm font-medium text-gray-700">孩子对应关系</p>
          <p className="mt-0.5 text-xs text-gray-400">把这里的孩子和学习系统里的孩子一一对应，AI 才能联合分析</p>
          <div className="mt-2 space-y-1">
            {(children ?? []).map((child) => (
              <KidStudyMapping
                key={child.id}
                childId={child.id}
                childName={child.name}
                kidstudyChildren={kidstudyChildren ?? []}
              />
            ))}
          </div>
          {kidstudyChildren && kidstudyChildren.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">无法读取学习系统的孩子列表，请检查地址和 PIN</p>
          )}
        </div>
      )}
    </section>
  );
}
