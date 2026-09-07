import { useState } from 'react';
import { api } from '../api/client';
import { useChildren, useCreateChild, useDeleteChild, useUpdateChild } from '../hooks/useChildren';
import { useMediaStatus } from '../hooks/useMedia';
import { AiProviderSettings } from '../components/settings/AiProviderSettings';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useQueryClient } from '@tanstack/react-query';

export function SettingsPage() {
  const { data: children } = useChildren();
  const { data: mediaStatus } = useMediaStatus();
  const createChild = useCreateChild();
  const updateChild = useUpdateChild();
  const deleteChild = useDeleteChild();
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      window.location.reload();
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-0">
      <h1 className="text-lg font-bold text-gray-900">设置</h1>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="font-semibold text-gray-900">孩子</h2>
        <ul className="space-y-2">
          {(children ?? []).map((child) => (
            <li key={child.id} className="flex items-center gap-2">
              {editingId === child.id ? (
                <>
                  <input
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    aria-label="孩子名字"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (editingName.trim()) {
                        updateChild.mutate({ id: child.id, name: editingName.trim() }, { onSuccess: () => setEditingId(null) });
                      }
                    }}
                  >
                    保存
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>取消</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{child.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingId(child.id); setEditingName(child.name); }}>改名</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => {
                      if (window.confirm(`删除「${child.name}」及其全部成长记录（档案、兴趣、事件）？此操作不可恢复。`)) {
                        deleteChild.mutate(child.id, { onSuccess: () => void qc.invalidateQueries({ queryKey: ['children'] }) });
                      }
                    }}
                  >
                    删除
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2 border-t border-gray-100 pt-3">
          <div className="flex-1">
            <Input label="添加孩子" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="名字" />
          </div>
          <Button
            disabled={!newName.trim()}
            loading={createChild.isPending}
            onClick={() => createChild.mutate({ name: newName.trim() }, { onSuccess: () => setNewName('') })}
          >
            添加
          </Button>
        </div>
      </section>

      <AiProviderSettings />

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <h2 className="font-semibold text-gray-900">照片库</h2>
        {mediaStatus?.configured ? (
          <p className="text-sm text-emerald-600">已连接（{mediaStatus.directoryCount} 个活动目录）。在成长事件的编辑里可以关联相册目录。</p>
        ) : (
          <p className="text-sm text-gray-500">
            未配置。部署时在 <code className="rounded bg-gray-100 px-1">.env</code> 中设置 <code className="rounded bg-gray-100 px-1">MEDIA_HOST_PATH</code>
            为照片库目录（如飞牛相册的存储目录）并重新创建容器后，活动照片功能即可使用。
          </p>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold text-gray-900">退出登录</h2>
        <p className="mt-1 text-sm text-gray-500">退出后需要重新输入家庭 PIN。</p>
        <Button variant="secondary" className="mt-3" onClick={() => void logout()}>退出家庭空间</Button>
      </section>
    </div>
  );
}
