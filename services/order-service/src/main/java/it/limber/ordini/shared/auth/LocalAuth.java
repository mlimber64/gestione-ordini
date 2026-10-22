package it.limber.ordini.shared.auth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Il componente esiste solo nella modalità di base, in cui order-service gestisce utenti e token (ADR 0021). */
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
@ConditionalOnProperty(name = "app.auth.mode", havingValue = "local", matchIfMissing = true)
public @interface LocalAuth {

}
