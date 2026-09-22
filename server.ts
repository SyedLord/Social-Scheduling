import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { db } from './server/db.js';
import { oauthService } from './server/oauth.js';
import { schedulingEngine } from './server/scheduler.js';
import { SocialPlatform, WorkspacePlan } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Start the background dispatch engine
schedulingEngine.start();

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'OmniPost Social Engine', time: new Date().toISOString() });
});

// ==========================================
// AUTHENTICATION & USER ROUTES
// ==========================================
app.get('/api/auth/me', (req: Request, res: Response) => {
  const users = db.getUsers();
  const requestedId = req.query.userId as string | undefined;
  if (requestedId) {
    const found = users.find((u) => u.id === requestedId);
    if (found) return res.json(found);
  }
  return res.status(401).json({ error: 'Not authenticated. Please log in.' });
});

app.get('/api/auth/users', (req: Request, res: Response) => {
  res.json(db.getUsers());
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const result = db.authenticate(email, password);
  if (result.error) return res.status(401).json({ error: result.error });
  res.json(result);
});

app.post('/api/auth/register', (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });
  const result = db.registerUser(name, email, password || 'user123', role);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result);
});

app.patch('/api/auth/profile', (req: Request, res: Response) => {
  const { id, name, email, password, avatar_url } = req.body;
  if (!id) return res.status(400).json({ error: 'User ID is required' });
  const updated = db.updateUserProfile(id, { name, email, password, avatar_url });
  if (!updated) return res.status(404).json({ error: 'User not found' });
  res.json(updated);
});

// ==========================================
// LICENSE MANAGEMENT (ADMIN & CLIENT)
// ==========================================
app.get('/api/admin/licenses', (req: Request, res: Response) => {
  res.json(db.getLicenseKeys());
});

app.post('/api/admin/licenses', (req: Request, res: Response) => {
  const { label, max_workspaces, validity_days, custom_key } = req.body;
  if (!max_workspaces || !validity_days) {
    return res.status(400).json({ error: 'max_workspaces and validity_days are required' });
  }
  const key = db.createLicenseKey({
    label: label || `License (${max_workspaces} Workspaces)`,
    max_workspaces: Number(max_workspaces),
    validity_days: Number(validity_days),
    custom_key,
  });
  res.status(201).json(key);
});

app.post('/api/admin/licenses/:id/revoke', (req: Request, res: Response) => {
  const result = db.revokeLicenseKey(req.params.id);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.post('/api/admin/reset-database', (req: Request, res: Response) => {
  const cleanData = db.resetAllData();
  res.json({ success: true, message: 'Database reset to clean state', data: cleanData });
});

app.delete('/api/admin/licenses/:id', (req: Request, res: Response) => {
  const success = db.deleteLicenseKey(req.params.id);
  if (!success) return res.status(404).json({ error: 'License key not found' });
  res.json({ success: true });
});

// Client License Status & Redemption
app.get('/api/users/:userId/license-status', (req: Request, res: Response) => {
  const status = db.getUserLicenseStatus(req.params.userId);
  res.json(status);
});

app.get('/api/users/:userId/license', (req: Request, res: Response) => {
  const status = db.getUserLicenseStatus(req.params.userId);
  res.json(status);
});

app.post('/api/users/:userId/redeem-license', (req: Request, res: Response) => {
  const { key } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'License key string is required' });
  }
  const result = db.redeemLicenseKey(req.params.userId, key);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

app.post('/api/users/:userId/select-active-workspaces', (req: Request, res: Response) => {
  const { activeWorkspaceIds } = req.body;
  if (!Array.isArray(activeWorkspaceIds)) {
    return res.status(400).json({ error: 'activeWorkspaceIds array is required' });
  }
  const result = db.setUserActiveWorkspaces(req.params.userId, activeWorkspaceIds);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  res.json(result);
});

// ==========================================
// WORKSPACE ROUTES
// ==========================================
app.get('/api/workspaces', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  const workspaces = db.getWorkspaces(userId);
  res.json(workspaces);
});

app.get('/api/workspaces/:id', (req: Request, res: Response) => {
  const ws = db.getWorkspaceById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  res.json(ws);
});

app.post('/api/workspaces', (req: Request, res: Response) => {
  const { name, plan, timezone, userId } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Workspace name is required' });
  }
  const result = db.createWorkspace(name.trim(), (plan as WorkspacePlan) || 'free', timezone || 'UTC', userId);
  if (result.error) return res.status(400).json({ error: result.error });
  res.status(201).json(result.workspace);
});

app.delete('/api/workspaces/:id', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  const result = db.deleteWorkspace(req.params.id, userId);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

app.post('/api/workspaces/:id/toggle-lock', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  const result = db.toggleWorkspaceLock(req.params.id, userId);
  if (!result.success) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.patch('/api/workspaces/:id/plan', (req: Request, res: Response) => {
  const { plan } = req.body;
  if (!['free', 'pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  const updated = db.updateWorkspacePlan(req.params.id, plan as WorkspacePlan);
  if (!updated) return res.status(404).json({ error: 'Workspace not found' });
  res.json(updated);
});

// ==========================================
// ACCOUNTS / CHANNELS ROUTES
// ==========================================
app.get('/api/workspaces/:id/accounts', (req: Request, res: Response) => {
  const accounts = db.getAccounts(req.params.id);
  res.json(accounts);
});

app.post('/api/workspaces/:id/accounts/sandbox-connect', (req: Request, res: Response) => {
  const ws = db.getWorkspaceById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  if (ws.is_locked) {
    return res.status(403).json({ error: 'This workspace is locked under current license quotas. Unlock it or upgrade your license key to connect accounts.' });
  }

  const { platform, handle } = req.body;
  if (!['twitter', 'instagram', 'facebook', 'linkedin', 'youtube'].includes(platform)) {
    return res.status(400).json({ error: 'Invalid platform' });
  }
  const result = oauthService.connectSandboxAccount(platform as SocialPlatform, req.params.id, handle);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  const accounts = db.getAccounts(req.params.id);
  res.status(201).json({ success: true, accounts });
});

app.delete('/api/workspaces/:id/accounts/:accId', (req: Request, res: Response) => {
  const success = db.removeAccount(req.params.id, req.params.accId);
  if (!success) return res.status(404).json({ error: 'Account not found' });
  res.json({ success: true });
});

app.post('/api/workspaces/:id/accounts/:accId/refresh', async (req: Request, res: Response) => {
  const result = await oauthService.refreshAccountToken(req.params.accId);
  if (!result.success) return res.status(400).json({ error: result.error });
  const accounts = db.getAccounts(req.params.id);
  res.json({ success: true, accounts });
});

// ==========================================
// POSTS ROUTES
// ==========================================
app.get('/api/workspaces/:id/posts', (req: Request, res: Response) => {
  const { status, platform, search } = req.query;
  const posts = db.getPosts(req.params.id, {
    status: status as string,
    platform: platform as string,
    search: search as string,
  });
  res.json(posts);
});

app.get('/api/workspaces/:id/posts/:postId', (req: Request, res: Response) => {
  const post = db.getPostById(req.params.id, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  res.json(post);
});

app.post('/api/workspaces/:id/posts', async (req: Request, res: Response) => {
  const ws = db.getWorkspaceById(req.params.id);
  if (!ws) return res.status(404).json({ error: 'Workspace not found' });
  if (ws.is_locked) {
    return res.status(403).json({ error: 'This workspace is locked due to license limits. Please unlock it via your license settings or renew/upgrade your license key.' });
  }

  const { content, media_urls, media_type, target_platforms, target_account_ids, status, scheduled_at, publish_immediately } = req.body;

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'Post content is required' });
  }
  if (!target_platforms || !Array.isArray(target_platforms) || target_platforms.length === 0) {
    return res.status(400).json({ error: 'Select at least one destination platform' });
  }

  const postStatus = publish_immediately ? 'scheduled' : (status || 'draft');
  const postScheduleTime = publish_immediately ? new Date().toISOString() : scheduled_at;

  const result = db.createPost({
    workspace_id: req.params.id,
    content: content.trim(),
    media_urls: media_urls || [],
    media_type: media_type || (media_urls && media_urls.length > 0 ? 'image' : 'none'),
    target_platforms,
    target_account_ids: target_account_ids || [],
    status: postStatus,
    scheduled_at: postScheduleTime,
  });

  if (result.error || !result.post) {
    return res.status(400).json({ error: result.error || 'Failed to create post' });
  }

  if (publish_immediately) {
    // Immediately run dispatch
    const dispatchRes = await schedulingEngine.dispatchPost(result.post);
    return res.status(201).json(dispatchRes.post);
  }

  res.status(201).json(result.post);
});

app.patch('/api/workspaces/:id/posts/:postId', (req: Request, res: Response) => {
  const result = db.updatePost(req.params.id, req.params.postId, req.body);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result.post);
});

app.delete('/api/workspaces/:id/posts/:postId', (req: Request, res: Response) => {
  const success = db.deletePost(req.params.id, req.params.postId);
  if (!success) return res.status(404).json({ error: 'Post not found' });
  res.json({ success: true });
});

app.post('/api/workspaces/:id/posts/:postId/duplicate', (req: Request, res: Response) => {
  const duplicated = db.duplicatePost(req.params.id, req.params.postId);
  if (!duplicated) return res.status(404).json({ error: 'Original post not found' });
  res.status(201).json(duplicated);
});

app.post('/api/workspaces/:id/posts/:postId/publish-now', async (req: Request, res: Response) => {
  const post = db.getPostById(req.params.id, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const result = await schedulingEngine.dispatchPost(post);
  res.json(result.post);
});

app.post('/api/workspaces/:id/posts/:postId/retry', async (req: Request, res: Response) => {
  const post = db.getPostById(req.params.id, req.params.postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  db.updatePost(req.params.id, post.id, {
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
    error_message: undefined,
    error_details: undefined,
  });

  const updatedPost = db.getPostById(req.params.id, req.params.postId);
  const result = await schedulingEngine.dispatchPost(updatedPost!);
  res.json(result.post);
});

app.post('/api/workspaces/:id/posts/:postId/reschedule', (req: Request, res: Response) => {
  const { scheduled_at } = req.body;
  if (!scheduled_at) return res.status(400).json({ error: 'New scheduled date/time is required' });

  const result = db.updatePost(req.params.id, req.params.postId, {
    scheduled_at,
    status: 'scheduled',
    error_message: undefined,
    error_details: undefined,
  });

  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result.post);
});

// ==========================================
// CALENDAR & ANALYTICS & LOGS
// ==========================================
app.get('/api/workspaces/:id/calendar', (req: Request, res: Response) => {
  const posts = db.getPosts(req.params.id);
  res.json(posts);
});

app.get('/api/workspaces/:id/analytics', (req: Request, res: Response) => {
  const analytics = db.getWorkspaceAnalytics(req.params.id);
  res.json(analytics);
});

app.get('/api/workspaces/:id/logs', (req: Request, res: Response) => {
  const logs = db.getDispatchLogs(req.params.id);
  res.json(logs);
});

// Manual trigger for background scheduler
app.post('/api/scheduler/trigger', async (req: Request, res: Response) => {
  const result = await schedulingEngine.pollAndDispatch();
  res.json({ message: 'Scheduler triggered manually', ...result });
});

// ==========================================
// OAUTH FLOW ROUTES
// ==========================================
app.get('/api/oauth/:platform/authorize', (req: Request, res: Response) => {
  const { platform } = req.params;
  const { workspaceId } = req.query;

  if (!workspaceId || typeof workspaceId !== 'string') {
    return res.status(400).json({ error: 'workspaceId query parameter is required' });
  }

  const authData = oauthService.generateAuthUrl(
    platform as SocialPlatform,
    workspaceId,
    req.protocol,
    req.get('host')
  );

  res.json(authData);
});

app.get('/api/oauth/:platform/callback', async (req: Request, res: Response) => {
  const { platform } = req.params;
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(`/?oauth_error=${encodeURIComponent(String(error_description || error))}`);
  }

  if (!code || !state) {
    return res.redirect('/?oauth_error=Missing+code+or+state+in+OAuth+callback');
  }

  const result = await oauthService.handleCallback(
    platform as SocialPlatform,
    String(code),
    String(state),
    req.protocol,
    req.get('host')
  );

  if (result.success) {
    return res.redirect(`/?oauth_success=${platform}&account_id=${result.accountId}`);
  } else {
    return res.redirect(`/?oauth_error=${encodeURIComponent(result.error || 'OAuth token exchange failed')}`);
  }
});

// Sandbox Consent Screen
app.get('/api/oauth/sandbox-consent', (req: Request, res: Response) => {
  const { platform, state, workspaceId } = req.query;
  const mockCode = `auth_code_${Date.now()}`;
  const callbackUrl = `/api/oauth/${platform}/callback?code=${mockCode}&state=${state}`;

  const platformNames: Record<string, string> = {
    twitter: 'X (Twitter)',
    instagram: 'Instagram Creator',
    facebook: 'Facebook Pages',
    linkedin: 'LinkedIn Share',
    youtube: 'YouTube Data API',
  };

  const name = platformNames[String(platform)] || 'Social Platform';

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Connect ${name} | OmniPost OAuth 2.0</title>
        <style>
          body { background: #09090b; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; max-width: 440px; width: 90%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          h2 { margin: 0 0 12px; font-size: 20px; font-weight: 600; }
          p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin-bottom: 24px; }
          .badge { display: inline-block; background: #27272a; color: #38bdf8; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-family: monospace; margin-bottom: 16px; }
          .btn-primary { background: #3b82f6; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 10px; font-weight: 600; display: block; margin-bottom: 12px; transition: background 0.2s; }
          .btn-primary:hover { background: #2563eb; }
          .btn-cancel { color: #71717a; text-decoration: none; font-size: 13px; }
          .btn-cancel:hover { color: #d4d4d8; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">OAuth 2.0 PKCE Verification</div>
          <h2>Authorize OmniPost for ${name}</h2>
          <p>OmniPost is requesting permission to publish posts, analyze engagements, and read basic channel profile information for your workspace.</p>
          <a href="${callbackUrl}" class="btn-primary">Authorize & Connect Account</a>
          <a href="/?oauth_cancelled=true" class="btn-cancel">Cancel and return to dashboard</a>
        </div>
      </body>
    </html>
  `);
});

// ==========================================
// AI CAPTION & HASHTAG GENERATOR
// ==========================================
app.post('/api/ai/generate-caption', async (req: Request, res: Response) => {
  const { prompt, platform, tone } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt or topic is required' });

  // If Gemini API key is configured, use GoogleGenAI
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && !apiKey.includes('MY_GEMINI_API_KEY')) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an elite social media strategist. Write an optimized post for ${platform || 'social media'}.
Topic/Idea: "${prompt}"
Tone: ${tone || 'Engaging and authoritative'}
Guidelines:
- Match character best practices for ${platform || 'social media'}.
- Include 3-5 relevant, high-traffic hashtags.
- Include a strong hook, concise body, and compelling call-to-action (CTA).
- Return ONLY the finalized post text ready to publish.`,
      });

      const text = response.text || '';
      return res.json({ caption: text.trim() });
    } catch (e: any) {
      console.warn('Gemini generation error, falling back to smart heuristic optimizer:', e.message);
    }
  }

  // Smart fallback caption engine
  const hashtagsMap: Record<string, string[]> = {
    twitter: ['#Tech', '#Growth', '#BuildingInPublic', '#SaaS'],
    linkedin: ['#Leadership', '#Innovation', '#BusinessStrategy', '#CreatorEconomy'],
    instagram: ['#CreatorVibes', '#DigitalCreator', '#VisualStorytelling', '#CreativeProcess'],
    facebook: ['#Community', '#BehindTheScenes', '#DailyInspiration', '#Updates'],
    youtube: ['#Shorts', '#Tutorial', '#TechTrends', '#Creator'],
  };

  const platformKey = (platform as string) || 'twitter';
  const tags = hashtagsMap[platformKey] || ['#SocialGrowth', '#Updates', '#SaaS'];
  const toneWord = tone || 'compelling';

  const caption = `🚀 ${prompt}\n\nHere is what makes this a game changer: consistency, precision, and authentic audience engagement. What do you think about this approach?\n\n${tags.join(' ')}`;

  res.json({ caption });
});

// ==========================================
// VITE CLIENT MIDDLEWARE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OmniPost] Server active at http://localhost:${PORT}`);
  });
}

startServer();
