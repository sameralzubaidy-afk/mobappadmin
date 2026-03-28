const { createClient } = require('@supabase/supabase-js');

(async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const service = createClient(supabaseUrl, serviceKey);
  const anon = createClient(supabaseUrl, anonKey);

  const email = `tmp.admin.diag.${Date.now()}@example.com`;
  const password = `TmpDiag!${Date.now()}Aa`;
  let userId = null;

  try {
    const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;

    const ins = await service.from('role_based_access_control').insert({ user_id: userId, role: 'admin' });
    if (ins.error) throw ins.error;

    const login = await anon.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;

    const roleRead = await anon
      .from('role_based_access_control')
      .select('user_id,role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();

    console.log(JSON.stringify({
      email,
      userId,
      loginOk: true,
      roleReadError: roleRead.error ? roleRead.error.message : null,
      roleReadData: roleRead.data || null,
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ email, userId, error: e.message || String(e) }, null, 2));
  } finally {
    if (userId) {
      await service.from('role_based_access_control').delete().eq('user_id', userId).eq('role', 'admin');
      await service.auth.admin.deleteUser(userId);
    }
  }
})();
