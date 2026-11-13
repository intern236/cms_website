import 'server-only'
import type { EditorContext } from '@/components/editor/post-editor'
import type { Access } from '@/lib/auth/access'
import { cloudinaryConfigured } from '@/lib/cloudinary/config'
import { listAuthors } from '@/lib/content/authors'
import { usedCategories, usedTags } from '@/lib/content/posts'
import type { Tx } from '@/lib/db'
import { can } from '@/lib/permissions'

export async function editorContext(tx: Tx, access: Access): Promise<EditorContext> {
  const { workspace, role } = access
  const s = workspace.settings
  const [authors, usedTagList, usedCategoryList] = await Promise.all([
    s.blog.authors ? listAuthors(tx, workspace.id) : [],
    usedTags(tx, workspace.id),
    usedCategories(tx, workspace.id),
  ])
  return {
    workspace: workspace.slug,
    siteUrl: workspace.siteUrl,
    basePath: s.blog.basePath,
    htmlPages: s.blog.htmlPages,
    faqsEnabled: s.blog.faqs,
    authorsEnabled: s.blog.authors,
    canPublish: can(role, 'posts.publish'),
    canDelete: can(role, 'posts.delete'),
    authors: authors.map((a) => ({ id: a.id, name: a.name, role: a.role })),
    usedTags: usedTagList,
    usedCategories: usedCategoryList,
    uploadsEnabled: cloudinaryConfigured(),
  }
}
