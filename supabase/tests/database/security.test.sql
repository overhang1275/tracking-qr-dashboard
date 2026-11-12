begin;
select plan(5);

set local role anon;
select throws_ok(
  $$select * from public.validations$$,
  '42501',
  'permission denied for table validations',
  'Unauthenticated clients cannot read validations'
);
reset role;

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000001';
set local "request.jwt.claim.role" = 'authenticated';
select is(
  (select count(*)::integer from public.profiles),
  0,
  'An authenticated account without an institutional profile sees no profiles'
);
select is(
  (select count(*)::integer from public.validations),
  0,
  'An authenticated account without an institutional profile sees no validations'
);
select throws_ok(
  $$select public.admin_update_institution_name('Prueba')$$,
  '42501',
  'administrator role required',
  'An account without an active administrator profile cannot call admin RPCs'
);
select ok(
  not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'),
  'Authenticated clients cannot directly update profiles or roles'
);

select * from finish();
rollback;
