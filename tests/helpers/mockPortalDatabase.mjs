// These tests inject their own database clients. The runtime pool is lazy and
// needs valid startup metadata even though the tests never connect through it.
process.env.TRIAL_DATASET = 'synthetic';
process.env.MYSQL_TRIAL_URL = 'mysql://fixture:fixture@127.0.0.1:1/uper_trial_mock_fixture';
delete process.env.MYSQL_TRIAL_SOCKET;
