import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { apiFetch } from '../../lib/api';
import type { CustomPage, NavLink, SectionConfigItem, SiteSettings } from '../../types/platform';

export function SiteDesignPanel() {
  const { data, refreshBootstrap, showToast } = usePlatform();
  const [form, setForm] = useState<Partial<SiteSettings>>({});
  const [sections, setSections] = useState<SectionConfigItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm({ ...data.settings });
      try {
        setSections(JSON.parse(data.settings.sections_config || '[]'));
      } catch {
        setSections([]);
      }
    }
  }, [data?.settings]);

  const uploadImageField = async (field: 'logo_url' | 'hero_image_url', file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload/branding', { method: 'POST', body: fd });
      setForm((prev) => ({ ...prev, [field]: res.url }));
      showToast('Image uploaded. Click Save Changes to apply.');
    } catch (err: any) {
      showToast(err?.message || 'Image upload failed.');
    }
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
  };

  const toggleSection = (idx: number) => {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, visible: !s.visible } : s)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          sections_config: JSON.stringify(sections),
        }),
      });
      await refreshBootstrap();
      showToast('Website design, branding, and sections saved.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Identity & Colors */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Brand Identity &amp; Theme Colors</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Platform Name</label>
            <input
              type="text"
              value={form.platform_name || ''}
              onChange={(e) => setForm({ ...form, platform_name: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Platform Tagline</label>
            <input
              type="text"
              value={form.tagline || ''}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Logo Upload</label>
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadImageField('logo_url', e.target.files?.[0])}
                />
              </label>
              {form.logo_url && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, logo_url: '' })}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Reset Default
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Footer Branding Credit</label>
            <input
              type="text"
              value={form.footer_credit || ''}
              onChange={(e) => setForm({ ...form, footer_credit: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { key: 'theme_navy', label: 'Primary Navy' },
            { key: 'theme_blue', label: 'Accent Blue' },
            { key: 'theme_gold', label: 'Subtle Gold' },
            { key: 'theme_bg', label: 'Page Background' },
          ].map((c) => (
            <div key={c.key}>
              <label className="mb-1 block text-xs font-semibold text-slate-700">{c.label}</label>
              <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2.5 py-1.5">
                <input
                  type="color"
                  value={form[c.key] || '#0b1528'}
                  onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
                  className="h-6 w-8 cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="font-mono-num text-xs text-slate-700">{form[c.key]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hero Section Texts & Image */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Homepage Hero &amp; Contact Settings</h2>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Kicker</label>
            <input
              type="text"
              value={form.hero_kicker || ''}
              onChange={(e) => setForm({ ...form, hero_kicker: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero CTA Button Text</label>
            <input
              type="text"
              value={form.hero_cta_label || ''}
              onChange={(e) => setForm({ ...form, hero_cta_label: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Headline</label>
            <input
              type="text"
              value={form.hero_headline || ''}
              onChange={(e) => setForm({ ...form, hero_headline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Subheadline</label>
            <textarea
              rows={2}
              value={form.hero_subheadline || ''}
              onChange={(e) => setForm({ ...form, hero_subheadline: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Hero Image URL or Upload</label>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                value={form.hero_image_url || ''}
                onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })}
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => uploadImageField('hero_image_url', e.target.files?.[0])}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">WhatsApp Number</label>
            <input
              type="text"
              value={form.whatsapp_number || ''}
              onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Contact Email</label>
            <input
              type="email"
              value={form.contact_email || ''}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Contact Phone Display</label>
            <input
              type="text"
              value={form.contact_phone || ''}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Office Hours</label>
            <input
              type="text"
              value={form.contact_hours || ''}
              onChange={(e) => setForm({ ...form, contact_hours: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-700">Academic Center Address</label>
            <input
              type="text"
              value={form.contact_address || ''}
              onChange={(e) => setForm({ ...form, contact_address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
          </div>
        </div>
      </div>

      {/* Homepage Section Visibility & Order */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Homepage Section Layout &amp; Order</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {sections.map((sec, idx) => (
            <div key={sec.id} className="flex items-center justify-between py-2.5">
              <label className="flex items-center gap-3 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  checked={sec.visible}
                  onChange={() => toggleSection(idx)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                <span>{sec.label}</span>
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(idx, -1)}
                  className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                  aria-label="Move section up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(idx, 1)}
                  className="rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                  aria-label="Move section down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg px-6 py-3 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--brand-navy)' }}
      >
        {saving ? 'Saving All Settings...' : 'Save Site & Design Changes'}
      </button>
    </form>
  );
}

export function TeacherProfilePanel() {
  const { data, refreshBootstrap, showToast } = usePlatform();
  const [form, setForm] = useState<Partial<SiteSettings>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) setForm({ ...data.settings });
  }, [data?.settings]);

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await apiFetch<{ url: string }>('/api/admin/upload/branding', { method: 'POST', body: fd });
      setForm((prev) => ({ ...prev, teacher_photo_url: res.url }));
      showToast('Teacher photo uploaded. Click Save to publish.');
    } catch (err: any) {
      showToast(err?.message || 'Upload failed.');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          teacher_name: form.teacher_name,
          teacher_title: form.teacher_title,
          teacher_subject: form.teacher_subject,
          teacher_bio: form.teacher_bio,
          teacher_photo_url: form.teacher_photo_url,
          teacher_credentials: form.teacher_credentials,
        }),
      });
      await refreshBootstrap();
      showToast('Teacher profile updated.');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update teacher profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="font-display text-lg font-bold text-slate-900">Edit Teacher Profile</h2>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Teacher Name</label>
          <input
            type="text"
            required
            value={form.teacher_name || ''}
            onChange={(e) => setForm({ ...form, teacher_name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Academic Title</label>
          <input
            type="text"
            value={form.teacher_title || ''}
            onChange={(e) => setForm({ ...form, teacher_title: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Subject Specialty</label>
          <input
            type="text"
            value={form.teacher_subject || ''}
            onChange={(e) => setForm({ ...form, teacher_subject: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Credentials Summary Line</label>
          <input
            type="text"
            value={form.teacher_credentials || ''}
            onChange={(e) => setForm({ ...form, teacher_credentials: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Teacher Portrait URL or Upload</label>
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              value={form.teacher_photo_url || ''}
              onChange={(e) => setForm({ ...form, teacher_photo_url: e.target.value })}
              className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
            />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              />
            </label>
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-700">Biography</label>
          <textarea
            rows={4}
            value={form.teacher_bio || ''}
            onChange={(e) => setForm({ ...form, teacher_bio: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-5 rounded-lg px-5 py-2.5 text-sm font-semibold text-white"
        style={{ backgroundColor: 'var(--brand-navy)' }}
      >
        {saving ? 'Saving...' : 'Save Teacher Profile'}
      </button>
    </form>
  );
}

export function PagesAndNavPanel() {
  const { refreshBootstrap, showToast } = usePlatform();
  const [navLinks, setNavLinks] = useState<NavLink[]>([]);
  const [pages, setPages] = useState<CustomPage[]>([]);
  const [newNavLabel, setNewNavLabel] = useState('');
  const [newNavTarget, setNewNavTarget] = useState('#courses');

  const [pageTitle, setPageTitle] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageSubtitle, setPageSubtitle] = useState('');
  const [pageContent, setPageContent] = useState('');

  const loadAll = async () => {
    const [navRes, pageRes] = await Promise.all([
      apiFetch<{ navLinks: NavLink[] }>('/api/admin/nav'),
      apiFetch<{ pages: CustomPage[] }>('/api/admin/pages'),
    ]);
    setNavLinks(navRes.navLinks);
    setPages(pageRes.pages);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const addNavLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/nav', {
      method: 'POST',
      body: JSON.stringify({
        label: newNavLabel,
        target: newNavTarget,
        sort_order: navLinks.length + 1,
        is_visible: true,
      }),
    });
    setNewNavLabel('');
    await loadAll();
    await refreshBootstrap();
    showToast('Navigation link added.');
  };

  const deleteNav = async (id: number) => {
    await apiFetch(`/api/admin/nav/${id}`, { method: 'DELETE' });
    await loadAll();
    await refreshBootstrap();
  };

  const addPage = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/pages', {
      method: 'POST',
      body: JSON.stringify({
        title: pageTitle,
        slug: pageSlug,
        subtitle: pageSubtitle,
        content: pageContent,
        is_published: true,
      }),
    });
    setPageTitle('');
    setPageSlug('');
    setPageSubtitle('');
    setPageContent('');
    await loadAll();
    await refreshBootstrap();
    showToast('Custom page published.');
  };

  const deletePage = async (id: number) => {
    await apiFetch(`/api/admin/pages/${id}`, { method: 'DELETE' });
    await loadAll();
    await refreshBootstrap();
    showToast('Page deleted.');
  };

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Top Bar Navigation Links</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {navLinks.map((n) => (
            <div key={n.id} className="flex items-center justify-between py-2.5 text-sm">
              <div>
                <span className="font-semibold text-slate-900">{n.label}</span>
                <span className="ml-2 text-xs text-slate-500">({n.target})</span>
              </div>
              <button
                type="button"
                onClick={() => deleteNav(n.id)}
                className="rounded p-1.5 text-red-600 hover:bg-red-50"
                aria-label="Delete nav link"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addNavLink} className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            required
            value={newNavLabel}
            onChange={(e) => setNewNavLabel(e.target.value)}
            placeholder="Link Label (e.g. Study Guide)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            required
            value={newNavTarget}
            onChange={(e) => setNewNavTarget(e.target.value)}
            placeholder="#section or /page/slug"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--brand-navy)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Link</span>
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-bold text-slate-900">Custom Website Pages</h2>
        <div className="mt-4 space-y-3">
          {pages.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3.5">
              <div>
                <p className="text-sm font-bold text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500">Route target: /page/{p.slug}</p>
              </div>
              <button
                type="button"
                onClick={() => deletePage(p.id)}
                className="rounded p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addPage} className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 sm:grid-cols-2">
          <input
            type="text"
            required
            value={pageTitle}
            onChange={(e) => setPageTitle(e.target.value)}
            placeholder="Page Title"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={pageSlug}
            onChange={(e) => setPageSlug(e.target.value)}
            placeholder="URL Slug (e.g. faq)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={pageSubtitle}
            onChange={(e) => setPageSubtitle(e.target.value)}
            placeholder="Subtitle"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <textarea
            rows={4}
            required
            value={pageContent}
            onChange={(e) => setPageContent(e.target.value)}
            placeholder="Page body content..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg px-4 py-2.5 text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--brand-blue)' }}
            >
              Create &amp; Publish Page
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
