package it.limber.ordini.identity.adapter.out.security;

import it.limber.ordini.config.SecurityProperties;
import it.limber.ordini.identity.application.TokenIssuer;
import it.limber.ordini.identity.application.TokenPair;
import it.limber.ordini.identity.domain.AppUser;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Emette token JWT firmati con HS256: uno di accesso (breve) e uno di refresh (lungo). */
@Component
class JwtTokenIssuer implements TokenIssuer {

	private final SecurityProperties.Jwt config;

	private final JwtEncoder encoder;

	private final JwtDecoder refreshDecoder;

	JwtTokenIssuer(SecurityProperties properties) {
		this.config = properties.jwt();
		this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(properties.jwtKey()));
		this.refreshDecoder = JwtSupport.decoder(properties, JwtSupport.REFRESH);
	}

	@Override
	public TokenPair issue(AppUser user) {
		Instant now = Instant.now();
		String access = encode(user, JwtSupport.ACCESS, now, config.accessTtl());
		String refresh = encode(user, JwtSupport.REFRESH, now, config.refreshTtl());
		return TokenPair.bearer(access, refresh, config.accessTtl().toSeconds());
	}

	@Override
	public Optional<String> usernameFromRefreshToken(String refreshToken) {
		try {
			Jwt jwt = refreshDecoder.decode(refreshToken);
			return Optional.ofNullable(jwt.getSubject());
		}
		catch (JwtException ex) {
			return Optional.empty();
		}
	}

	private String encode(AppUser user, String tokenUse, Instant now, java.time.Duration ttl) {
		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer(config.issuer())
			.subject(user.getUsername())
			.issuedAt(now)
			.expiresAt(now.plus(ttl))
			.id(UUID.randomUUID().toString())
			.claim(JwtSupport.TOKEN_USE_CLAIM, tokenUse)
			.claim(JwtSupport.ROLES_CLAIM, List.of(user.getRole().name()))
			.build();
		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
	}

}
