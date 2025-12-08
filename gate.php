<?php
// gate.php — seta cookie e redireciona de volta

// Define o cookie por 1 dia, apenas para seu domínio
$domain = $_SERVER['HTTP_HOST'];
setcookie('site_gate', 'ok', [
  'expires'  => time() + 86400,
  'path'     => '/',
  'domain'   => $domain,
  'secure'   => isset($_SERVER['HTTPS']),
  'httponly' => false,
  'samesite' => 'Lax',
]);

// Volta para a URL original (se existir), senão vai para /
$back = '/';
if (!empty($_SERVER['HTTP_REFERER'])) {
  // aceitar apenas referer do próprio site
  if (preg_match('#^https?://'.preg_quote($domain, '#').'/#i', $_SERVER['HTTP_REFERER'])) {
    $back = $_SERVER['HTTP_REFERER'];
  }
}

// Redireciona
header('Location: ' . $back, true, 302);
exit;
