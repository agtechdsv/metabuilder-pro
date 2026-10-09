/**
 * Ouve os mesmos comandos em mais de um tópico: o privado (`tunnel-cmd:<projeto>:<hmac>`, o caminho novo) e o público de
 * sempre (`tunnel:<projeto>`, só para um servidor que ainda não foi atualizado). Os tratadores são registrados uma vez e
 * valem nos dois. Envios sem destino certo (avisos de progresso) continuam indo ao canal `sendTo`.
 *
 * Os comandos continuam sendo conferidos por assinatura em qualquer um dos dois: o que muda é que um servidor atualizado
 * já não publica comandos num canal que qualquer um pode ouvir.
 */
function fanIn(channels, sendTo) {
  const wrapper = {
    on(type, filter, callback) {
      for (const c of channels) c.on(type, filter, callback);
      return wrapper;
    },
    send(msg) {
      return sendTo.send(msg);
    },
    // "pronto" só quando TODOS os tópicos estão inscritos; qualquer falha é repassada na hora
    subscribe(callback) {
      let ready = 0;
      for (const c of channels) {
        c.subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            ready += 1;
            if (ready === channels.length) callback('SUBSCRIBED', err);
          } else {
            callback(status, err);
          }
        });
      }
    },
    unsubscribe() {
      for (const c of channels) c.unsubscribe();
    },
    get bindings() {
      return sendTo.bindings;
    },
  };
  return wrapper;
}

module.exports = { fanIn };
