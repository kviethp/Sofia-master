.PHONY: bootstrap doctor up smoke reset test backup restore

bootstrap:
	node scripts/bootstrap.mjs

doctor:
	node apps/sofia-api/scripts/doctor.js

up:
	node scripts/up.mjs

smoke:
	node apps/sofia-api/scripts/smoke.js

reset:
	node scripts/reset.mjs

test:
	node scripts/test.mjs

backup:
	node scripts/backup.mjs

restore:
	node scripts/restore.mjs
