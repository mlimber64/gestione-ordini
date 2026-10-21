package it.limber.ordini.catalog.adapter.in.web;

import it.limber.ordini.catalog.application.CategoryService;
import it.limber.ordini.catalog.application.CategoryService.CategoryCommand;
import it.limber.ordini.catalog.application.CategoryService.CategoryView;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/categories")
class CategoryController {

	record CategoryRequest(@NotBlank @Size(max = 80) String name, UUID parentId) {

		CategoryCommand toCommand() {
			return new CategoryCommand(name, parentId);
		}

	}

	private final CategoryService categories;

	CategoryController(CategoryService categories) {
		this.categories = categories;
	}

	@GetMapping
	List<CategoryView> list() {
		return categories.list();
	}

	@PostMapping
	@PreAuthorize("hasRole('ADMIN')")
	ResponseEntity<CategoryView> create(@Valid @RequestBody CategoryRequest request) {
		CategoryView created = categories.create(request.toCommand());
		URI location = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}").buildAndExpand(created.id()).toUri();
		return ResponseEntity.created(location).body(created);
	}

	@PutMapping("/{id}")
	@PreAuthorize("hasRole('ADMIN')")
	CategoryView update(@PathVariable UUID id, @Valid @RequestBody CategoryRequest request) {
		return categories.update(id, request.toCommand());
	}

}
