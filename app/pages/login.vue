<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="card bg-base-100 card-border w-full max-w-sm">
      <div class="card-body gap-4">
        <h2 class="card-title text-2xl">Sign in</h2>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Username</legend>
          <input
            type="text"
            class="input w-full"
            placeholder="Enter your username"
            autocomplete="username"
          />
        </fieldset>

        <fieldset class="fieldset">
          <legend class="fieldset-legend">Password</legend>
          <input
            type="password"
            class="input w-full"
            placeholder="Enter your password"
            autocomplete="current-password"
          />
<!--          <p class="label">-->
<!--            <a href="#" class="link link-hover link-primary text-xs">Forgot password?</a>-->
<!--          </p>-->
        </fieldset>

        <div class="card-actions flex-col mt-2">
          <button class="btn btn-primary btn-block">Sign in</button>
<!--          <p class="text-center text-sm">-->
<!--            Don't have an account?-->
<!--            <a href="#" class="link link-primary">Sign up</a>-->
<!--          </p>-->
        </div>
      </div>
    </div>
  </div>
</template>
