package it.limber.ordini.shared.auth;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Il componente esiste solo con un identity provider esterno (Keycloak): gli utenti e i token non sono nostri (ADR 0021). */
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
@ConditionalOnProperty(name = "app.auth.mode", havingValue = "oidc")
public @interface OidcAuth {

}
